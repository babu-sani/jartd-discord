type RenderFn = (container: HTMLElement) => void;

const screens: Record<string, RenderFn> = {};
let appEl: HTMLElement;

export function registerScreen(name: string, fn: RenderFn) {
  screens[name] = fn;
}

export function navigateTo(name: string) {
  appEl.innerHTML = '';
  appEl.className = 'screen-enter';
  if (screens[name]) {
    screens[name](appEl);
  }
}

export function initApp() {
  appEl = document.getElementById('app')!;
}
