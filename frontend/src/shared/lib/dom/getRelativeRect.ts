export function getRelativeRect(element: Element, container: Element) {
  const elementRect = element.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();

  return {
    top: elementRect.top - containerRect.top,
    left: elementRect.left - containerRect.left,
    right: containerRect.right - elementRect.right,
    height: elementRect.height,
  };
}
