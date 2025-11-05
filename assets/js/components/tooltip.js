// Enhanced Tooltip System
class FloatingTooltip {
  constructor() {
    this.tooltip = null;
    this.init();
  }

  init() {
    // Create floating tooltip element
    this.tooltip = document.createElement("div");
    this.tooltip.className = "floating-tooltip";
    this.tooltip.style.cssText = `
      position: fixed;
      background: #1f2937;
      color: white;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 0.75rem;
      font-weight: 400;
      white-space: nowrap;
      pointer-events: none;
      z-index: 10000;
      opacity: 0;
      transition: opacity 0.2s ease;
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
      max-width: 300px;
    `;
    document.body.appendChild(this.tooltip);

    this.bindEvents();
  }

  bindEvents() {
    const labels = document.querySelectorAll("form label");

    labels.forEach((label) => {
      const tooltipText = label.querySelector(".tooltip")?.textContent;
      if (!tooltipText) return;

      label.addEventListener("mouseenter", (e) => {
        this.show(tooltipText, e);
      });

      label.addEventListener("mousemove", (e) => {
        this.move(e);
      });

      label.addEventListener("mouseleave", () => {
        this.hide();
      });
    });
  }

  show(text, e) {
    this.tooltip.textContent = text;
    this.tooltip.style.opacity = "1";
    this.move(e);
  }

  move(e) {
    const x = e.clientX + 15;
    const y = e.clientY + 15;

    // Boundary checking
    const tooltipRect = this.tooltip.getBoundingClientRect();
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    let finalX = x;
    let finalY = y;

    // Adjust if tooltip goes beyond right edge
    if (x + tooltipRect.width > windowWidth - 10) {
      finalX = e.clientX - tooltipRect.width - 15;
    }

    // Adjust if tooltip goes beyond bottom edge
    if (y + tooltipRect.height > windowHeight - 10) {
      finalY = e.clientY - tooltipRect.height - 15;
    }

    this.tooltip.style.left = finalX + "px";
    this.tooltip.style.top = finalY + "px";
  }

  hide() {
    this.tooltip.style.opacity = "0";
  }
}

// Initialize when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  new FloatingTooltip();
});
