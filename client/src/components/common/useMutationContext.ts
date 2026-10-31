import { useEffect, useRef } from "react";
import type { ApiReadContext } from "../../api.js";

// Reuse the transport's post-body context check for mutations. Capture the
// originating session predicate; later renders must never revive old work.
export function useMutationContext(identity: string, isSessionCurrent: () => boolean) {
  const access = useRef({ identity, isSessionCurrent });
  access.current = { identity, isSessionCurrent };
  const lifetime = useRef(0);
  const mounted = useRef(false);
  const controllers = useRef(new Set<AbortController>());
  useEffect(() => {
    mounted.current = true;
    const invalidate = () => { ++lifetime.current; controllers.current.forEach(controller => controller.abort()); controllers.current.clear(); };
    window.addEventListener("session-access-changed", invalidate);
    return () => { mounted.current = false; invalidate(); window.removeEventListener("session-access-changed", invalidate); };
  }, [identity]);
  return () => {
    const origin = access.current, token = lifetime.current, controller = new AbortController();
    controllers.current.add(controller);
    const context: ApiReadContext = { signal: controller.signal, isCurrent: () => mounted.current && !controller.signal.aborted && token === lifetime.current && origin.identity === access.current.identity && origin.isSessionCurrent() };
    return { context, finish: () => controllers.current.delete(controller) };
  };
}
