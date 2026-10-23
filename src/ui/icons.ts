import {
  mdiFormatListCheckbox,
  mdiChartTimelineVariant,
  mdiPlus,
  mdiDeleteOutline,
  mdiCodeTags,
  mdiContentSaveOutline,
  mdiAlertCircleOutline,
  mdiThemeLightDark,
  mdiChartBar,
  mdiChartLine,
  mdiChartDonut,
  mdiGraphOutline,
  mdiFormatBold,
  mdiFormatItalic,
  mdiFormatStrikethrough,
  mdiFormatHeader1,
  mdiFormatHeader2,
  mdiFormatHeader3,
  mdiFormatListBulleted,
  mdiFormatListNumbered,
  mdiFormatQuoteClose,
  mdiMinus,
  mdiUndo,
  mdiRedo,
  mdiTable,
  mdiFileDocumentEditOutline,
  mdiEye,
  mdiEyeOutline,
  mdiEyeOffOutline,
  mdiCalendarMonthOutline,
  mdiLinkVariant,
  mdiFilePdfBox,
  mdiPrinter,
  mdiArrowUp,
  mdiArrowDown,
} from '@mdi/js';

export {
  mdiFormatListCheckbox,
  mdiChartTimelineVariant,
  mdiPlus,
  mdiDeleteOutline,
  mdiCodeTags,
  mdiContentSaveOutline,
  mdiAlertCircleOutline,
  mdiThemeLightDark,
  mdiChartBar,
  mdiChartLine,
  mdiChartDonut,
  mdiGraphOutline,
  mdiFormatBold,
  mdiFormatItalic,
  mdiFormatStrikethrough,
  mdiFormatHeader1,
  mdiFormatHeader2,
  mdiFormatHeader3,
  mdiFormatListBulleted,
  mdiFormatListNumbered,
  mdiFormatQuoteClose,
  mdiMinus,
  mdiUndo,
  mdiRedo,
  mdiTable,
  mdiFileDocumentEditOutline,
  mdiEye,
  mdiEyeOutline,
  mdiEyeOffOutline,
  mdiCalendarMonthOutline,
  mdiLinkVariant,
  mdiFilePdfBox,
  mdiPrinter,
  mdiArrowUp,
  mdiArrowDown,
};

/**
 * Returns an inline SVG string for server-side HTML rendering (e.g. Webview Provider HTML)
 */
export function renderMdiIconSvg(path: string, size = 18, className = 'mdi-icon'): string {
  return `<svg class="${className}" viewBox="0 0 24 24" width="${size}" height="${size}" fill="currentColor" aria-hidden="true" style="display:inline-block;vertical-align:middle;flex-shrink:0;"><path d="${path}" /></svg>`;
}

/**
 * Creates an SVGSVGElement for client-side DOM manipulation in Webviews
 */
export function createMdiIcon(path: string, size = 18, className = 'mdi-icon'): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('fill', 'currentColor');
  svg.setAttribute('aria-hidden', 'true');
  if (className) {
    svg.setAttribute('class', className);
  }
  svg.style.display = 'inline-block';
  svg.style.verticalAlign = 'middle';
  svg.style.flexShrink = '0';

  const pathElem = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  pathElem.setAttribute('d', path);
  svg.appendChild(pathElem);
  return svg;
}
