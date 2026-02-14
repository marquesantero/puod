/**
 * Canvas Layout Utilities
 * Provides automatic arrangement algorithms for dashboard cards
 */

export interface CanvasCard {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  cardType?: string;
}

export type LayoutType = "grid" | "masonry" | "dashboard" | "focus" | "sidebar";

const GRID_SIZE = 40;
const CARD_MARGIN = 20;
const CANVAS_PADDING = 20;

/**
 * Snap value to grid
 */
export function snapToGrid(value: number): number {
  return Math.round(value / GRID_SIZE) * GRID_SIZE;
}

/**
 * Grid Layout - Organizes cards in uniform grid
 */
export function arrangeGrid(cards: CanvasCard[], canvasWidth: number): CanvasCard[] {
  if (cards.length === 0) return [];

  const cols = Math.floor(canvasWidth / 400); // 400px base card width
  const cardWidth = Math.floor((canvasWidth - CANVAS_PADDING * 2 - CARD_MARGIN * (cols - 1)) / cols);
  const cardHeight = 300;

  return cards.map((card, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);

    return {
      ...card,
      x: CANVAS_PADDING + col * (cardWidth + CARD_MARGIN),
      y: CANVAS_PADDING + row * (cardHeight + CARD_MARGIN),
      width: cardWidth,
      height: cardHeight,
    };
  });
}

/**
 * Masonry Layout - Pinterest-style with variable heights
 */
export function arrangeMasonry(cards: CanvasCard[], canvasWidth: number): CanvasCard[] {
  if (cards.length === 0) return [];

  const cols = 3;
  const cardWidth = Math.floor((canvasWidth - CANVAS_PADDING * 2 - CARD_MARGIN * (cols - 1)) / cols);
  const columnHeights = new Array(cols).fill(CANVAS_PADDING);

  return cards.map((card) => {
    // Find shortest column
    const shortestCol = columnHeights.indexOf(Math.min(...columnHeights));

    const arranged = {
      ...card,
      x: CANVAS_PADDING + shortestCol * (cardWidth + CARD_MARGIN),
      y: columnHeights[shortestCol],
      width: cardWidth,
    };

    // Update column height
    columnHeights[shortestCol] += card.height + CARD_MARGIN;

    return arranged;
  });
}

/**
 * Dashboard Layout - KPIs at top, charts/tables below
 */
export function arrangeDashboard(cards: CanvasCard[], canvasWidth: number): CanvasCard[] {
  if (cards.length === 0) return [];

  // Separate by type
  const kpis = cards.filter((c) => c.cardType === "kpi");
  const others = cards.filter((c) => c.cardType !== "kpi");

  const result: CanvasCard[] = [];
  let currentY = CANVAS_PADDING;

  // KPIs in top row
  if (kpis.length > 0) {
    const kpiWidth = Math.floor((canvasWidth - CANVAS_PADDING * 2 - CARD_MARGIN * (kpis.length - 1)) / kpis.length);
    const kpiHeight = 200;

    kpis.forEach((card, index) => {
      result.push({
        ...card,
        x: CANVAS_PADDING + index * (kpiWidth + CARD_MARGIN),
        y: currentY,
        width: kpiWidth,
        height: kpiHeight,
      });
    });

    currentY += kpiHeight + CARD_MARGIN * 2;
  }

  // Others in 2-column grid
  if (others.length > 0) {
    const cols = 2;
    const cardWidth = Math.floor((canvasWidth - CANVAS_PADDING * 2 - CARD_MARGIN * (cols - 1)) / cols);
    const cardHeight = 400;

    others.forEach((card, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);

      result.push({
        ...card,
        x: CANVAS_PADDING + col * (cardWidth + CARD_MARGIN),
        y: currentY + row * (cardHeight + CARD_MARGIN),
        width: cardWidth,
        height: cardHeight,
      });
    });
  }

  return result;
}

/**
 * Focus Layout - 1 large card + smaller cards on side
 */
export function arrangeFocus(cards: CanvasCard[], canvasWidth: number): CanvasCard[] {
  if (cards.length === 0) return [];

  const result: CanvasCard[] = [];

  // Main card (first one) - large on left
  const mainWidth = Math.floor((canvasWidth - CANVAS_PADDING * 2 - CARD_MARGIN) * 0.65);
  const sideWidth = canvasWidth - CANVAS_PADDING * 2 - mainWidth - CARD_MARGIN;

  if (cards.length > 0) {
    result.push({
      ...cards[0],
      x: CANVAS_PADDING,
      y: CANVAS_PADDING,
      width: mainWidth,
      height: 600,
    });
  }

  // Side cards - stacked on right
  const sideCardHeight = 180;
  cards.slice(1).forEach((card, index) => {
    result.push({
      ...card,
      x: CANVAS_PADDING + mainWidth + CARD_MARGIN,
      y: CANVAS_PADDING + index * (sideCardHeight + CARD_MARGIN),
      width: sideWidth,
      height: sideCardHeight,
    });
  });

  return result;
}

/**
 * Sidebar Layout - Narrow sidebar + main content
 */
export function arrangeSidebar(cards: CanvasCard[], canvasWidth: number): CanvasCard[] {
  if (cards.length === 0) return [];

  const result: CanvasCard[] = [];

  // Sidebar (first 3 cards) - left side
  const sidebarWidth = 300;
  const mainWidth = canvasWidth - CANVAS_PADDING * 2 - sidebarWidth - CARD_MARGIN;
  const sideCardHeight = 200;

  cards.slice(0, 3).forEach((card, index) => {
    result.push({
      ...card,
      x: CANVAS_PADDING,
      y: CANVAS_PADDING + index * (sideCardHeight + CARD_MARGIN),
      width: sidebarWidth,
      height: sideCardHeight,
    });
  });

  // Main area cards (rest) - right side
  const cols = 2;
  const cardWidth = Math.floor((mainWidth - CARD_MARGIN * (cols - 1)) / cols);
  const cardHeight = 300;

  cards.slice(3).forEach((card, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);

    result.push({
      ...card,
      x: CANVAS_PADDING + sidebarWidth + CARD_MARGIN + col * (cardWidth + CARD_MARGIN),
      y: CANVAS_PADDING + row * (cardHeight + CARD_MARGIN),
      width: cardWidth,
      height: cardHeight,
    });
  });

  return result;
}

/**
 * Auto-distribute spacing between cards
 */
export function distributeEvenly(cards: CanvasCard[], direction: "horizontal" | "vertical"): CanvasCard[] {
  if (cards.length < 2) return cards;

  const sorted = [...cards].sort((a, b) => (direction === "horizontal" ? a.x - b.x : a.y - b.y));

  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  const totalSpace =
    direction === "horizontal" ? last.x - first.x - first.width : last.y - first.y - first.height;

  const spacing = totalSpace / (sorted.length - 1);

  let currentPos = direction === "horizontal" ? first.x : first.y;

  return sorted.map((card) => {
    const result = {
      ...card,
      ...(direction === "horizontal" ? { x: currentPos } : { y: currentPos }),
    };

    currentPos += spacing + (direction === "horizontal" ? card.width : card.height);

    return result;
  });
}

/**
 * Align cards to edge
 */
export function alignCards(
  cards: CanvasCard[],
  alignment: "left" | "right" | "top" | "bottom" | "center-h" | "center-v"
): CanvasCard[] {
  if (cards.length === 0) return cards;

  switch (alignment) {
    case "left": {
      const minX = Math.min(...cards.map((c) => c.x));
      return cards.map((c) => ({ ...c, x: minX }));
    }
    case "right": {
      const maxX = Math.max(...cards.map((c) => c.x + c.width));
      return cards.map((c) => ({ ...c, x: maxX - c.width }));
    }
    case "top": {
      const minY = Math.min(...cards.map((c) => c.y));
      return cards.map((c) => ({ ...c, y: minY }));
    }
    case "bottom": {
      const maxY = Math.max(...cards.map((c) => c.y + c.height));
      return cards.map((c) => ({ ...c, y: maxY - c.height }));
    }
    case "center-h": {
      const avgY = cards.reduce((sum, c) => sum + c.y, 0) / cards.length;
      return cards.map((c) => ({ ...c, y: avgY }));
    }
    case "center-v": {
      const avgX = cards.reduce((sum, c) => sum + c.x, 0) / cards.length;
      return cards.map((c) => ({ ...c, x: avgX }));
    }
    default:
      return cards;
  }
}

/**
 * Check if two cards overlap
 */
export function checkOverlap(card1: CanvasCard, card2: CanvasCard): boolean {
  return !(
    card1.x + card1.width < card2.x ||
    card2.x + card2.width < card1.x ||
    card1.y + card1.height < card2.y ||
    card2.y + card2.height < card1.y
  );
}

/**
 * Find nearest snap position for a card
 */
export function findSnapPosition(
  card: CanvasCard,
  otherCards: CanvasCard[],
  threshold: number = 20
): { x: number; y: number; snapLines: { type: "vertical" | "horizontal"; position: number }[] } {
  const snapLines: { type: "vertical" | "horizontal"; position: number }[] = [];
  let snapX = card.x;
  let snapY = card.y;

  for (const other of otherCards) {
    if (other.id === card.id) continue;

    // Horizontal snapping (align tops, bottoms, centers)
    const topDiff = Math.abs(card.y - other.y);
    const bottomDiff = Math.abs(card.y + card.height - (other.y + other.height));
    const centerYDiff = Math.abs(card.y + card.height / 2 - (other.y + other.height / 2));

    if (topDiff < threshold) {
      snapY = other.y;
      snapLines.push({ type: "horizontal", position: other.y });
    } else if (bottomDiff < threshold) {
      snapY = other.y + other.height - card.height;
      snapLines.push({ type: "horizontal", position: other.y + other.height });
    } else if (centerYDiff < threshold) {
      snapY = other.y + other.height / 2 - card.height / 2;
      snapLines.push({ type: "horizontal", position: other.y + other.height / 2 });
    }

    // Vertical snapping (align lefts, rights, centers)
    const leftDiff = Math.abs(card.x - other.x);
    const rightDiff = Math.abs(card.x + card.width - (other.x + other.width));
    const centerXDiff = Math.abs(card.x + card.width / 2 - (other.x + other.width / 2));

    if (leftDiff < threshold) {
      snapX = other.x;
      snapLines.push({ type: "vertical", position: other.x });
    } else if (rightDiff < threshold) {
      snapX = other.x + other.width - card.width;
      snapLines.push({ type: "vertical", position: other.x + other.width });
    } else if (centerXDiff < threshold) {
      snapX = other.x + other.width / 2 - card.width / 2;
      snapLines.push({ type: "vertical", position: other.x + other.width / 2 });
    }
  }

  return { x: snapX, y: snapY, snapLines };
}
