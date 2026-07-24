// Reveal declarativo de grupos de contenido en scroll ("Elements Reveal on Scroll",
// portado 1:1 del patrón usado en el portafolio). Reemplaza el reveal CSS de
// transitions-dev: acá tanto el disparo (ScrollTrigger) como la animación (autoAlpha + y)
// son GSAP, con el mismo start/clamp que motion.ts y split-text.ts, así todos los
// reveals de la página quedan sincronizados al mismo punto de scroll.
import { gsap, ScrollTrigger, prefersReducedMotion, ENTER_DELAY } from './gsap-env';

type Slot =
  | { type: 'item'; el: HTMLElement }
  | {
      type: 'nested';
      parentEl: HTMLElement;
      nestedEl: HTMLElement;
      includeParent: boolean;
      nestedChildren: HTMLElement[];
    };

// expo.out (no power4.inOut): la entrada arranca rápido y asienta suave. inOut ramp-ea
// lento al inicio → el reveal se siente pesado. expo.out es la firma del Portfolio2026.
const ANIM_DURATION = 0.9;
const ANIM_EASE = 'expo.out';

const isElement = (node: Node): node is HTMLElement => node.nodeType === 1;

export function initRevealGroup(root: HTMLElement): void {
  root.querySelectorAll<HTMLElement>('[data-reveal-group]').forEach(revealGroup);
}

// Arma el reveal de UN grupo. Extraído de initRevealGroup para poder rearmarlo sobre
// contenido inyectado async (p. ej. el grid de equipo tras el fetch al Sheet), sin
// depender de que el elemento existiera en el DOM al momento del boot.
export function revealGroup(groupEl: HTMLElement): void {
    // Sin navegador (prerender en Node) no hay animación que preparar. Salir antes de tocar
    // GSAP evita el registro de plugins y, sobre todo, evita hornear autoAlpha:0 en el HTML:
    // contenido oculto es peor que ausente para un crawler.
    if (typeof window === 'undefined') return;

    const groupStaggerSec = (parseFloat(groupEl.getAttribute('data-stagger') || '100')) / 1000;
    const groupDistance = groupEl.getAttribute('data-distance') || '2em';
    // clamp(): mismo motivo que en motion.ts/split-text.ts — evita un offset inválido
    // cerca del tope del documento y mantiene todos los reveals en el mismo punto de scroll.
    const triggerStart = `clamp(${groupEl.getAttribute('data-start') || 'top 80%'})`;
    // Modo mount: dispara al montar (no en scroll). Para elementos above-the-fold cuyo
    // ScrollTrigger no dispararía de forma fiable — mismo criterio que data-aa-split="mount".
    const onMount = groupEl.getAttribute('data-reveal-group') === 'mount';

    if (prefersReducedMotion) {
      gsap.set(groupEl, { clearProps: 'all', y: 0, autoAlpha: 1 });
      return;
    }

    const directChildren = Array.from(groupEl.children).filter(isElement);

    // Sin hijos directos: anima el grupo completo como un solo bloque.
    if (!directChildren.length) {
      gsap.set(groupEl, { y: groupDistance, autoAlpha: 0 });
      const play = () =>
        gsap.to(groupEl, {
          y: 0,
          autoAlpha: 1,
          duration: ANIM_DURATION,
          ease: ANIM_EASE,
          onComplete: () => gsap.set(groupEl, { clearProps: 'all' }),
        });
      if (onMount) gsap.delayedCall(ENTER_DELAY, play);
      else ScrollTrigger.create({ trigger: groupEl, start: triggerStart, once: true, onEnter: play });
      return;
    }

    // Arma los slots de animación: item simple o grupo anidado (data-reveal-group-nested).
    const slots: Slot[] = [];
    directChildren.forEach((child) => {
      const nestedGroup = child.matches('[data-reveal-group-nested]')
        ? child
        : child.querySelector<HTMLElement>(':scope [data-reveal-group-nested]');

      if (nestedGroup) {
        const includeParent =
          child.getAttribute('data-ignore') !== 'true' &&
          (child.getAttribute('data-ignore') === 'false' || nestedGroup.getAttribute('data-ignore') === 'false');
        const nestedChildren = Array.from(nestedGroup.children)
          .filter(isElement)
          .filter((el) => el.getAttribute('data-ignore') !== 'true');
        slots.push({ type: 'nested', parentEl: child, nestedEl: nestedGroup, includeParent, nestedChildren });
      } else {
        if (child.getAttribute('data-ignore') === 'true') return;
        slots.push({ type: 'item', el: child });
      }
    });

    // Estado inicial oculto.
    slots.forEach((slot) => {
      if (slot.type === 'item') {
        const isNestedSelf = slot.el.matches('[data-reveal-group-nested]');
        const distance = isNestedSelf ? groupDistance : slot.el.getAttribute('data-distance') || groupDistance;
        gsap.set(slot.el, { y: distance, autoAlpha: 0 });
      } else {
        if (slot.includeParent) gsap.set(slot.parentEl, { y: groupDistance, autoAlpha: 0 });
        const nestedDistance = slot.nestedEl.getAttribute('data-distance') || groupDistance;
        slot.nestedChildren.forEach((target) => gsap.set(target, { y: nestedDistance, autoAlpha: 0 }));
      }
    });

    // Reafirma la distancia del grupo en el padre incluido (por si su nested group
    // declaró una data-distance propia que no debe heredar el padre).
    slots.forEach((slot) => {
      if (slot.type === 'nested' && slot.includeParent) gsap.set(slot.parentEl, { y: groupDistance });
    });

    const play = () => {
      const tl = gsap.timeline();

      slots.forEach((slot, slotIndex) => {
          const slotTime = slotIndex * groupStaggerSec;

          if (slot.type === 'item') {
            tl.to(
              slot.el,
              {
                y: 0,
                autoAlpha: 1,
                duration: ANIM_DURATION,
                ease: ANIM_EASE,
                onComplete: () => gsap.set(slot.el, { clearProps: 'all' }),
              },
              slotTime,
            );
            return;
          }

          if (slot.includeParent) {
            tl.to(
              slot.parentEl,
              {
                y: 0,
                autoAlpha: 1,
                duration: ANIM_DURATION,
                ease: ANIM_EASE,
                onComplete: () => gsap.set(slot.parentEl, { clearProps: 'all' }),
              },
              slotTime,
            );
          }

          const nestedMs = parseFloat(slot.nestedEl.getAttribute('data-stagger') || '');
          const nestedStaggerSec = Number.isNaN(nestedMs) ? groupStaggerSec : nestedMs / 1000;
          slot.nestedChildren.forEach((nestedChild, nestedIndex) => {
            tl.to(
              nestedChild,
              {
                y: 0,
                autoAlpha: 1,
                duration: ANIM_DURATION,
                ease: ANIM_EASE,
                onComplete: () => gsap.set(nestedChild, { clearProps: 'all' }),
              },
              slotTime + nestedIndex * nestedStaggerSec,
            );
          });
      });
    };

    if (onMount) gsap.delayedCall(ENTER_DELAY, play);
    else ScrollTrigger.create({ trigger: groupEl, start: triggerStart, once: true, onEnter: play });
}
