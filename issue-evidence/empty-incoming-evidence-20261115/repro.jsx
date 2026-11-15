import React from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from '@easypost/easy-ui/Provider';
import { InvestigationWorkbench } from '@easypost/easy-ui/InvestigationWorkspace';
import '@easypost/easy-ui/style.css';
import '@easypost/easy-ui/NetworkMap/maplibre-gl.css';
import workerUrl from '@easypost/easy-ui/NetworkMap/maplibre-gl-worker.mjs?worker&url';

const graph = {
  events: [
    { id: 'accepted', label: 'Accepted', timeLabel: '12:00', locationLabel: 'Facility A' },
    { id: 'processed', label: 'Processed', timeLabel: '12:10', locationLabel: 'Facility B' },
    { id: 'delivered', label: 'Delivered', timeLabel: '12:20', locationLabel: 'Facility C' },
  ],
  connections: [
    { id: 'first', fromEventId: 'accepted', toEventId: 'processed' },
    { id: 'second', fromEventId: 'processed', toEventId: 'delivered' },
  ],
  paths: [{ id: 'recorded', label: 'Recorded history', color: '#146eb4', connectionIds: ['first', 'second'] }],
};
const query = new URLSearchParams(location.search);
const hasMetrics = query.has('metrics');
const colorScheme = query.get('theme') === 'dark' ? 'dark' : 'light';
document.documentElement.style.background = colorScheme === 'dark' ? '#151b26' : '#ffffff';
document.body.style.margin = '24px';

createRoot(document.getElementById('root')).render(
  <Provider colorScheme={colorScheme}>
    <InvestigationWorkbench
      title="Generic chronology"
      graph={graph}
      map={{ mapStyle: { version: 8, sources: {}, layers: [] }, workerUrl, height: 560 }}
      renderConnectionMetrics={hasMetrics ? () => <span>Observed interval: 10 min</span> : undefined}
    />
  </Provider>,
);
