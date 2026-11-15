import React from 'react';
import {createRoot} from 'react-dom/client';
import {ThemeProvider} from '@easypost/easy-ui/Theme';
import {InvestigationWorkbench, type InvestigationGraph} from '@easypost/easy-ui/InvestigationWorkspace';
import '@easypost/easy-ui/style.css';
import '@easypost/easy-ui/NetworkMap/maplibre-gl.css';
import workerUrl from '@easypost/easy-ui/NetworkMap/maplibre-gl-worker.mjs?worker&url';

const params=new URLSearchParams(location.search);
const dark=params.has('dark');
const independent=params.has('independent');
const colors=dark?['#7394ff','#ffad61']:['#164dff','#834003'];
const graph: InvestigationGraph={
  locations:[
    {id:'a',label:'Synthetic A',coordinates:[-100,40],kind:'hub'},
    {id:'b',label:'Synthetic B',coordinates:[-98,41],kind:'hub'},
  ],
  events:[
    {id:'event-a',label:'Observation A',locationId:'a',timeLabel:'08:00'},
    {id:'event-b',label:'Observation B',locationId:'b',timeLabel:'09:00'},
    {id:'event-c',label:'Observation C',locationId:'a',timeLabel:'10:00'},
    ...(independent ? [
      {id:'event-d',label:'Observation D',locationId:'b',timeLabel:'11:00'},
    ] : []),
  ],
  connections:[
    {id:'connection-blue',fromEventId:'event-a',toEventId:'event-b',segmentId:'segment-blue'},
    {id:'connection-orange',fromEventId:independent?'event-c':'event-a',toEventId:independent?'event-d':'event-b',segmentId:'segment-orange'},
    ...(independent ? [] : [
      {id:'connection-orange-return',fromEventId:'event-b',toEventId:'event-c',segmentId:'segment-orange-return'},
    ]),
  ],
  segments:[
    {id:'segment-blue',from:'a',to:'b',label:'Blue connection',evidence:'transfer'},
    {id:'segment-orange',from:'a',to:'b',label:'Orange connection',evidence:'transfer'},
    ...(independent ? [] : [
      {id:'segment-orange-return',from:'b',to:'a',label:'Orange return',evidence:'transfer' as const},
    ]),
  ],
  paths:[
    {id:'blue',label:'Synthetic Blue',color:colors[0],connectionIds:['connection-blue']},
    {id:'orange',label:'Synthetic Orange',color:colors[1],connectionIds:independent?['connection-orange']:['connection-orange','connection-orange-return']},
  ],
};
const mapStyle={version:8 as const,sources:{},layers:[{id:'background',type:'background' as const,paint:{'background-color':dark?'#19212e':'#edf2f7'}}]};
Object.assign(window,{syntheticGraph:graph});
createRoot(document.getElementById('root')!).render(
  <ThemeProvider colorScheme={dark?'dark':'light'}>
    <main style={{maxWidth:1200,margin:'24px auto'}}>
      <InvestigationWorkbench
        title={independent?'Independent observations control':'Shared observations, coincident connection geometry'}
        showHistoryLabels
        openDetailsOnSelection={false}
        graph={graph}
        map={{mapStyle,workerUrl,height:520,onMapReady:map=>Object.assign(window,{nativeMap:map})}}
      />
    </main>
  </ThemeProvider>
);
