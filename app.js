(function () {
  'use strict';
  const sample = '0324101A01C614A2873C52ABA870010010089AF166285C59A4C86408FE29C16C01054010F010';
  const raw = document.getElementById('raw');
  const message = document.getElementById('message');
  const mapPlaceholder = document.getElementById('map-placeholder');
  const mapLink = document.getElementById('map-link');
  let map = null;
  let markers = null;
  const groups = {
    control: [['Format version', 'version'], ['Message identifier', 'messageIdentifier'], ['Activation', 'activation'], ['Call type', 'callType'], ['Position confidence', 'confidence'], ['Event time (UTC)', 'time']],
    vehicle: [['Vehicle category', 'vehicleType'], ['VIN', 'vin'], ['Propulsion storage', 'propulsion'], ['Occupants', 'occupants']],
    position: [['Current position', 'position'], ['Position N-1', 'point1'], ['Position N-2', 'point2'], ['Direction of travel', 'direction'], ['N-1 delta (lat / lon)', 'delta1'], ['N-2 delta (lat / lon)', 'delta2'], ['Raw latitude / longitude', 'rawPosition']],
    additional: [['Relative OID', 'oid'], ['Data (hex)', 'data'], ['Encoded length', 'length'], ['Trailing bytes ignored', 'ignored']]
  };
  function display(values) {
    for (const [group, fields] of Object.entries(groups)) {
      const list = document.getElementById(group + '-fields');
      list.replaceChildren();
      for (const [label, key] of fields) {
        const row = document.createElement('div'); row.className = 'field';
        const term = document.createElement('dt'); term.textContent = label;
        const value = document.createElement('dd');
        value.textContent = values && values[key] != null ? values[key] : '\u2014';
        if (!values) value.classList.add('empty');
        if (['vin', 'data', 'oid', 'rawPosition'].includes(key)) value.classList.add('mono');
        row.append(term, value); list.append(row);
      }
    }
  }
  function coords(point) { return point && Math.abs(point.latitude) <= 90 && Math.abs(point.longitude) <= 180 ? `${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}` : 'Unknown'; }
  function delta(value) { return value ? `${value.latitude} / ${value.longitude} (100 mas)` : 'Not present'; }
  function updateMap(result) {
    mapLink.hidden = !result || !result.position;
    if (markers) markers.clearLayers();
    if (!result || !result.position) {
      mapPlaceholder.hidden = false;
      mapPlaceholder.querySelector('strong').textContent = 'No location to display';
      mapPlaceholder.querySelector('span').textContent = 'Decode a message with valid coordinates';
      return;
    }
    const position = result.position;
    mapLink.href = `https://www.openstreetmap.org/?mlat=${position.latitude}&mlon=${position.longitude}#map=17/${position.latitude}/${position.longitude}`;
    if (!window.L) {
      mapPlaceholder.hidden = false;
      mapPlaceholder.querySelector('strong').textContent = 'Map unavailable';
      mapPlaceholder.querySelector('span').textContent = 'Open the location in OpenStreetMap instead';
      return;
    }
    mapPlaceholder.hidden = true;
    if (!map) {
      map = L.map('map', { zoomControl: true });
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(map);
      markers = L.layerGroup().addTo(map);
    }
    const points = [[result.position, 'Current position', '#d85e42'], [result.point1, 'Position N-1', '#e8a668'], [result.point2, 'Position N-2', '#718b80']];
    const bounds = [];
    points.forEach(([point, label, color]) => {
      if (!point || Math.abs(point.latitude) > 90 || Math.abs(point.longitude) > 180) return;
      const latlng = [point.latitude, point.longitude]; bounds.push(latlng);
      L.circleMarker(latlng, { radius: 7, color: '#ffffff', weight: 2, fillColor: color, fillOpacity: 1 }).bindPopup(`${label}<br>${coords(point)}`).addTo(markers);
    });
    map.invalidateSize();
    if (bounds.length > 1) map.fitBounds(bounds, { padding: [85, 85], maxZoom: 17 });
    else map.setView(bounds[0], 17);
  }
  function reset() {
    display(null); updateMap(null);
    document.getElementById('result-status').textContent = 'AWAITING MESSAGE';
  }
  function decode() {
    try {
      const result = MSDDecoder.decode(raw.value);
      display({ version: result.version, messageIdentifier: result.messageIdentifier, activation: result.automatic ? 'Automatic' : 'Manual',
        callType: result.test ? 'Test call' : 'Emergency', confidence: result.trusted ? 'Position can be trusted' : 'Low confidence',
        time: result.timestamp ? new Date(result.timestamp * 1000).toISOString().replace('T', ' ').replace('.000Z', ' UTC') : 'Unknown (0)',
        vehicleType: result.vehicleType, vin: result.vin, propulsion: result.propulsion.length ? result.propulsion.join(', ') : 'None reported / unknown',
        occupants: result.occupants === null || result.occupants === 255 ? 'Unknown' : String(result.occupants),
        position: coords(result.position), point1: result.recent1 ? coords(result.point1) : 'Not present', point2: result.recent2 ? coords(result.point2) : 'Not present',
        direction: result.direction === 255 ? 'Unknown' : `${result.direction * 2}\u00b0`,
        delta1: delta(result.recent1), delta2: delta(result.recent2),
        rawPosition: `${result.latitude} / ${result.longitude} mas`, oid: result.additional ? result.additional.oid : 'Not present',
        data: result.additional ? result.additional.data || '(empty)' : 'Not present', length: `${result.encodedBytes} bytes`, ignored: `${result.ignoredBytes} bytes` });
      updateMap(result);
      message.textContent = 'Message decoded successfully'; message.className = 'message success';
      document.getElementById('result-status').textContent = `VERSION ${result.version} / DECODED`;
    } catch (error) {
      reset(); message.textContent = error.message; message.className = 'message error';
    }
  }
  function countBytes() { const clean = raw.value.replace(/\s/g, ''); document.getElementById('byte-count').textContent = `${Math.floor(clean.length / 2)} bytes`; }
  document.getElementById('decode').addEventListener('click', decode);
  document.getElementById('sample').addEventListener('click', () => { raw.value = sample; countBytes(); decode(); });
  document.getElementById('clear').addEventListener('click', () => { raw.value = ''; countBytes(); reset(); message.textContent = 'Ready for a message'; message.className = 'message'; });
  raw.addEventListener('input', () => { countBytes(); reset(); message.textContent = 'Ready for a message'; message.className = 'message'; });
  reset();
})();