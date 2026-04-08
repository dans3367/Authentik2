import type { RootFieldErrorState } from "./puck-shared";

let rootFieldErrorState: RootFieldErrorState = { title: false };
const rootFieldErrorListeners = new Set<() => void>();

function emitRootFieldErrorChange() {
  rootFieldErrorListeners.forEach((listener) => listener());
}

export const rootFieldErrors = {
  get title() {
    return rootFieldErrorState.title;
  },
  set title(value: boolean) {
    if (rootFieldErrorState.title === value) return;
    rootFieldErrorState = { ...rootFieldErrorState, title: value };
    emitRootFieldErrorChange();
  },
};

export function subscribeRootFieldErrors(listener: () => void) {
  rootFieldErrorListeners.add(listener);
  return () => rootFieldErrorListeners.delete(listener);
}

export function getRootFieldErrorState() {
  return rootFieldErrorState;
}
