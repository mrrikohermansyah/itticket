// Enhanced Tooltip System with Advanced Features
class FloatingTooltip {
  constructor() {
    this.tooltip = null;
    this.currentTarget = null;
    this.init();
  }

  init() {
    // Create floating tooltip element with better styling
    this.tooltip = document.createElement("div");
    this.tooltip.className = "enhanced-floating-tooltip";
    this.tooltip.style.cssText = `
      position: fixed;
      background: linear-gradient(135deg, #1f2937 0%, #374151 100%);
      color: white;
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 0.8rem;
      font-weight: 400;
      line-height: 1.4;
      pointer-events: none;
      z-index: 10000;
      opacity: 0;
      transform: translateY(-5px);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 
        0 20px 25px -5px rgba(0, 0, 0, 0.15),
        0 10px 10px -5px rgba(0, 0, 0, 0.04),
        0 0 0 1px rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(8px);
      max-width: 280px;
      word-wrap: break-word;
      white-space: normal;
      text-align: center;
      border: 1px solid rgba(255, 255, 255, 0.1);
    `;
    document.body.appendChild(this.tooltip);

    this.bindEvents();
  }

  bindEvents() {
    // Bind to all elements that need tooltips
    const elementsWithTooltips = document.querySelectorAll([
      'form label',
      '.btn-action',
      '.assigned-to-other',
      '.stat-card',
      '.priority-badge',
      '.status-badge',
      '[data-tooltip]'
    ].join(','));

    elementsWithTooltips.forEach((element) => {
      const tooltipText = this.getTooltipText(element);
      if (!tooltipText) return;

      element.style.cursor = 'help';
      element.setAttribute('data-enhanced-tooltip', 'true');

      element.addEventListener('mouseenter', (e) => {
        this.show(tooltipText, e, element);
      });

      element.addEventListener('mousemove', (e) => {
        this.move(e);
      });

      element.addEventListener('mouseleave', () => {
        this.hide();
      });

      // Touch support for mobile
      element.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this.show(tooltipText, e, element);
      });

      element.addEventListener('touchend', () => {
        this.hide();
      });
    });

    // Close tooltip on scroll
    document.addEventListener('scroll', () => {
      this.hide();
    });
  }

  getTooltipText(element) {
    // Priority order for tooltip text
    return (
      element.getAttribute('data-tooltip') ||
      element.querySelector('.tooltip')?.textContent ||
      element.getAttribute('title') ||
      this.getDefaultTooltip(element)
    );
  }

  getDefaultTooltip(element) {
    // Default tooltips for common elements
    const defaults = {
      '.btn-view': 'View ticket details',
      '.btn-take': 'Take this ticket and start working on it',
      '.btn-edit': 'Edit or update ticket',
      '.btn-resolve': 'Mark ticket as resolved',
      '.btn-reopen': 'Reopen closed ticket',
      '.btn-delete': 'Delete ticket permanently',
      '.assigned-to-other': 'This ticket is assigned to another admin',
      '.priority-high': 'High priority - requires immediate attention',
      '.priority-medium': 'Medium priority - important but not urgent', 
      '.priority-low': 'Low priority - can be handled later',
      '.status-open': 'Ticket is open and waiting for assignment',
      '.status-progress': 'Ticket is in progress',
      '.status-resolved': 'Ticket has been resolved',
      '.stat-card': 'Click to filter by this status'
    };

    for (const [selector, tooltip] of Object.entries(defaults)) {
      if (element.matches(selector) || element.closest(selector)) {
        return tooltip;
      }
    }

    return null;
  }

  show(text, e, target) {
    this.currentTarget = target;
    
    // Remove title attribute temporarily to prevent browser tooltip
    if (target.getAttribute('title')) {
      target.setAttribute('data-original-title', target.getAttribute('title'));
      target.removeAttribute('title');
    }

    this.tooltip.textContent = text;
    this.tooltip.style.opacity = "1";
    this.tooltip.style.transform = "translateY(0)";
    this.move(e);

    // Add animation class
    this.tooltip.classList.add('tooltip-visible');
  }

  move(e) {
    if (!this.tooltip.textContent) return;

    const x = e.clientX + 15;
    const y = e.clientY + 15;

    // Boundary checking with more precise calculations
    const tooltipRect = this.tooltip.getBoundingClientRect();
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;

    let finalX = x + scrollX;
    let finalY = y + scrollY;

    // Adjust if tooltip goes beyond right edge
    if (x + tooltipRect.width > windowWidth - 20) {
      finalX = e.clientX - tooltipRect.width - 5 + scrollX;
    }

    // Adjust if tooltip goes beyond left edge
    if (finalX < scrollX + 10) {
      finalX = scrollX + 10;
    }

    // Adjust if tooltip goes beyond bottom edge
    if (y + tooltipRect.height > windowHeight - 20) {
      finalY = e.clientY - tooltipRect.height - 5 + scrollY;
    }

    // Adjust if tooltip goes beyond top edge
    if (finalY < scrollY + 10) {
      finalY = scrollY + 10;
    }

    this.tooltip.style.left = finalX + "px";
    this.tooltip.style.top = finalY + "px";
  }

  hide() {
    this.tooltip.style.opacity = "0";
    this.tooltip.style.transform = "translateY(-5px)";
    this.tooltip.classList.remove('tooltip-visible');

    // Restore title attribute
    if (this.currentTarget && this.currentTarget.getAttribute('data-original-title')) {
      this.currentTarget.setAttribute('title', this.currentTarget.getAttribute('data-original-title'));
      this.currentTarget.removeAttribute('data-original-title');
    }

    this.currentTarget = null;
  }

  // Method to manually show tooltip (for programmatic use)
  showManual(text, x, y, target = null) {
    this.currentTarget = target;
    this.tooltip.textContent = text;
    this.tooltip.style.opacity = "1";
    this.tooltip.style.transform = "translateY(0)";
    this.tooltip.style.left = x + "px";
    this.tooltip.style.top = y + "px";
    this.tooltip.classList.add('tooltip-visible');
  }

  // Method to manually hide tooltip
  hideManual() {
    this.hide();
  }

  // Destroy tooltip system
  destroy() {
    if (this.tooltip && this.tooltip.parentNode) {
      this.tooltip.parentNode.removeChild(this.tooltip);
    }
  }
}

// Additional CSS for enhanced tooltip (add to your CSS file)
const enhancedTooltipStyles = `
.enhanced-floating-tooltip::before {
  content: '';
  position: absolute;
  top: -6px;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 6px solid transparent;
  border-right: 6px solid transparent;
  border-bottom: 6px solid #1f2937;
}

.enhanced-floating-tooltip.tooltip-visible {
  animation: tooltipBounce 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes tooltipBounce {
  0% {
    opacity: 0;
    transform: translateY(-8px) scale(0.95);
  }
  50% {
    transform: translateY(2px) scale(1.02);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* Mobile optimizations */
@media (max-width: 768px) {
  .enhanced-floating-tooltip {
    font-size: 0.75rem;
    padding: 8px 12px;
    max-width: 200px;
  }
}
`;

// Add styles to document
const styleSheet = document.createElement('style');
styleSheet.textContent = enhancedTooltipStyles;
document.head.appendChild(styleSheet);

// Initialize when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  window.enhancedTooltip = new FloatingTooltip();
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FloatingTooltip;
}