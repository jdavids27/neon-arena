export function createInput(domElement) {
  const keys = new Set();
  const press = (e) => keys.add(e.code);
  const release = (e) => keys.delete(e.code);
  window.addEventListener('keydown', press);
  window.addEventListener('keyup', release);
  window.addEventListener('blur', () => keys.clear());

  return {
    isDown: (code) => keys.has(code),
    isAny: (...codes) => codes.some((c) => keys.has(c)),
    dispose() {
      window.removeEventListener('keydown', press);
      window.removeEventListener('keyup', release);
    },
  };
}
