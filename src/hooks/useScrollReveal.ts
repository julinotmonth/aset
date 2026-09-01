import { useLayoutEffect, type RefObject } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

interface ScrollRevealOptions {
  /** Distance (px) elements travel in on reveal. Default 28. */
  y?: number;
  /** Animation duration in seconds. Default 0.7. */
  duration?: number;
  /** Stagger between elements entering around the same scroll position. Default 0.08. */
  stagger?: number;
  /** ScrollTrigger start position. Default 'top 88%'. */
  start?: string;
  ease?: string;
}

/**
 * Reveals every direct match of `selector` inside `containerRef` as it scrolls
 * into view, using GSAP + ScrollTrigger. Respects prefers-reduced-motion and
 * cleans itself up (killing its ScrollTriggers) whenever `deps` change or the
 * component unmounts — safe to use in components with conditional content.
 */
export function useScrollReveal(
  containerRef: RefObject<HTMLElement | null>,
  selector: string,
  deps: unknown[] = [],
  options: ScrollRevealOptions = {}
) {
  useLayoutEffect(() => {
    if (!containerRef.current) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const ctx = gsap.context(() => {
      const els = gsap.utils.toArray<HTMLElement>(selector);
      if (!els.length) return;

      if (reduceMotion) {
        gsap.set(els, { opacity: 1, y: 0 });
        return;
      }

      gsap.set(els, { opacity: 0, y: options.y ?? 28 });
      els.forEach((el, i) => {
        gsap.to(el, {
          opacity: 1,
          y: 0,
          duration: options.duration ?? 0.7,
          ease: options.ease ?? 'expo.out',
          delay: (i % 6) * (options.stagger ?? 0.08),
          scrollTrigger: {
            trigger: el,
            start: options.start ?? 'top 88%',
            toggleActions: 'play none none none',
          },
        });
      });
    }, containerRef);

    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
