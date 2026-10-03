// Deterministic SDK double: tests UI behavior without billing Google or loading tiles.
export async function installGoogleMapsFixture(context, options = {}) {
  await context.addInitScript(options => {
    class Bounds { constructor() { this.points=[]; } extend(p) { this.points.push(p); } isEmpty() { return !this.points.length; } }
    class Map {
      constructor(node) { this.node=node; this.zoom=13; node.replaceChildren(); }
      addListener(name, fn) { const click=e=>fn({latLng:{lat:()=>10.84,lng:()=>106.67}}); if(name==='click')this.node.addEventListener('click',click);return {remove:()=>this.node.removeEventListener('click',click)}; }
      fitBounds() {} panTo() {} getZoom(){return this.zoom;} setZoom(v){this.zoom=v;}
    }
    class Marker {
      constructor({map, title}) { this.node=document.createElement('button');this.node.type='button';this.node.className=title === 'Vị trí của bạn' ? 'test-google-user' : 'test-google-marker';this.node.textContent=title; map.node.append(this.node); }
      addListener(name, fn){this.node.addEventListener(name,event=>{event.stopPropagation();fn();});}
      set map(value){if(!value)this.node.remove();}
    }
    class InfoWindow {
      setContent(node){this.content=node;node.className='test-google-popup';}
      open({map}){map.node.append(this.content);}
      close(){this.content?.remove();}
    }
    class Geocoder {
      async geocode(query) {
        const rows=options.rows || [{place_id:'test-place',display_name:query.address || 'Selected address',lat:10.84,lon:106.67}];
        return {results:rows.map(row=>({place_id:row.place_id,formatted_address:query.location?(options.reverseAddress || 'Selected address'):row.display_name,geometry:{location:{lat:()=>Number(row.lat),lng:()=>Number(row.lon)}}}))};
      }
    }
    const maps={LatLngBounds:Bounds,InfoWindow,Polyline:class{setMap(){}},marker:{AdvancedMarkerElement:Marker},geometry:{encoding:{decodePath:()=>[]}},event:{clearInstanceListeners(){}},importLibrary:async name=>name==='maps'?{Map}:name==='geocoding'?{Geocoder}:{}};
    window.google={maps};
  }, options);
}
