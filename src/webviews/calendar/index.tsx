import React from 'react';
import { createRoot } from 'react-dom/client';
import { CalendarMonthApp, CalendarInitialData } from './CalendarMonthApp';
import { CalendarDayDetailsApp } from './CalendarDayDetailsApp';

function getInitialData(): CalendarInitialData {
  try {
    const el = document.getElementById('initial-data');
    if (el && el.textContent) {
      return JSON.parse(el.textContent);
    }
  } catch {}
  return {};
}

const container = document.getElementById('root');
if (container) {
  const initialData = getInitialData();
  const root = createRoot(container);

  if (initialData.mode === 'day-details') {
    root.render(<CalendarDayDetailsApp initialData={initialData} />);
  } else {
    root.render(<CalendarMonthApp initialData={initialData} />);
  }
}

