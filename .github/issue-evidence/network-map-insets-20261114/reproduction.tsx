import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { NetworkMap } from '@easypost/easy-ui/NetworkMap';
import { ThemeProvider } from '@easypost/easy-ui/Theme';
import '@easypost/easy-ui/style.css';
import '@easypost/easy-ui/NetworkMap/maplibre-gl.css';
import workerUrl from '@easypost/easy-ui/NetworkMap/maplibre-gl-worker.mjs?worker&url';
const facilities = [
 {id:'first',label:'First synthetic observation',coordinates:[-83.7,42.96] as const,kind:'hub' as const},
 {id:'second',label:'Second synthetic observation',coordinates:[-83.7,42.96] as const,kind:'hub' as const},
 {id:'far',label:'Remote synthetic observation',coordinates:[-122.4,42.96] as const,kind:'hub' as const},
];
const mapStyle = {version:8 as const,sources:{},layers:[{id:'background',type:'background' as const,paint:{'background-color':'#edf2f7'}}]};
const zoomSections = [{id:'nearby',title:'Nearby scan locations',facilityIds:facilities.map(({id})=>id)}];
const search = new URLSearchParams(location.search);
function App(){const [selected,setSelected]=useState<string>();return <ThemeProvider colorScheme="light"><main style={{width:'100%',maxWidth:search.has('wide')?650:310,margin:'24px auto',fontFamily:'sans-serif'}}><NetworkMap title={null} description={null} aria-label="Synthetic observations" facilities={facilities} selectedFacilityId={selected} onFacilitySelect={setSelected} mapStyle={mapStyle} workerUrl={workerUrl} zoomSections={zoomSections} controls={{fitAll:true,navigation:true,latestEvent:false,selectedSegment:false,risk:false,weather:false,deliverySurface:false,scale:true}} controlLabels={{fitAll:'Fit'}} controlPlacement="map" height={520} initialView={search.has('wide')?{center:[-101,53],zoom:3}:undefined} typography={search.has('large')?{control:18}:undefined} showLegend={false} showDataTable={false} showSelectionDetails={false}/></main></ThemeProvider>}
createRoot(document.getElementById('root')!).render(<App/>);
