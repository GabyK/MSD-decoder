(function () {
  'use strict';
  const example = '0324101A01C614A2873C52ABA870010010089AF166285C59A4C86408FE29C16C01054010F010';
  const imageExample = '032e501a1940b8604d1ccb4634520492492fe10000000022427d24df8998b780201829ff7cffc0820041420d3fdfe000000000';
  const version2Example = '02251C0680E30A51439E2955D43800800437F80A3105669023F8A71166932185B004150043C040';
  const version2NoLocation = '021E00050DC3C168E65A30A51400000010220800000007FFFFFFFFFFFFFFFFF8';
  const version2Additional = '022A5C0680E30A51439E2955D438008004340A8C4159A408FE29C459A4C8616C01054010F0101008101657F0';
  const assertions = [];
  function check(name, condition) { assertions.push({ name, passed: Boolean(condition) }); }
  function rejects(name, input) { try { MSDDecoder.decode(input); check(name, false); } catch (error) { check(name, true); } }
  const standard = MSDDecoder.decode(example);
  check('version and message identifier', standard.version === 3 && standard.messageIdentifier === 1);
  check('control values', standard.automatic && !standard.test && standard.trusted && standard.vehicleType === 'Passenger vehicle (M1)');
  check('VIN', standard.vin === 'ECALLEXAMPLE02020');
  check('propulsion', standard.propulsion.join(',') === 'Gasoline,Electric');
  check('timestamp and location', standard.timestamp === 1579992331 && standard.latitude === 187996428 && standard.longitude === 18859320);
  check('direction and recent locations', standard.direction === 45 && standard.recent1.longitude === 10 && standard.recent2.longitude === 30);
  check('occupants and absent additional data', standard.occupants === 2 && standard.additional === null);
  const screenshot = MSDDecoder.decode(imageExample);
  check('screenshot VIN and type', screenshot.vin === 'A1VC2TESTCTAG9999' && screenshot.vehicleType === 'Light commercial vehicle (N1)');
  check('screenshot optional data', screenshot.additional.oid === '8.1' && screenshot.additional.data === '0834FF7F80');
  check('screenshot location', Math.abs(screenshot.position.latitude - 42.12427) < 0.00001 && Math.abs(screenshot.point2.longitude + 8.62196) < 0.00001);
  check('ignore bytes after encoded message', screenshot.encodedBytes === 48 && screenshot.ignoredBytes === 3);
  const version2 = MSDDecoder.decode(version2Example);
  check('version 2 identity and control', version2.version === 2 && version2.messageIdentifier === 1 && version2.vin === 'ECALLEXAMPLE02013' && version2.automatic && !version2.test && version2.trusted && version2.vehicleType === 'Passenger vehicle (M1)');
  check('version 2 time and location', version2.timestamp === 1367878452 && version2.latitude === 18859320 && version2.longitude === 187996428 && version2.direction === 45);
  check('version 2 propulsion and optional values', version2.propulsion.join(',') === 'Gasoline' && version2.recent1.longitude === 10 && version2.recent2.longitude === 30 && version2.occupants === 2);
  const noLocation = MSDDecoder.decode(version2NoLocation);
  check('version 2 missing locations and passengers', noLocation.test && noLocation.vin === 'VF1TESTCALL000042' && noLocation.recent1 === null && noLocation.recent2 === null && noLocation.occupants === null && noLocation.position === null);
  const additional = MSDDecoder.decode(version2Additional);
  check('version 2 additional data', additional.additional.oid === '1.2' && additional.additional.data === 'CAFE');
  function version2Locations(first, second) {
    const bits = version2Example.slice(4).match(/../g).map(byte => parseInt(byte, 16).toString(2).padStart(8, '0')).join('');
    const payload = (bits.slice(0, 3) + Number(first) + Number(second) + bits.slice(5, 243) + (first ? bits.slice(243, 263) : '') + (second ? bits.slice(263, 283) : '') + bits.slice(283, 291)).padEnd(first && second ? 296 : first || second ? 272 : 256, '0');
    const hex = payload.match(/.{8}/g).map(byte => parseInt(byte, 2).toString(16).padStart(2, '0')).join('');
    return '02' + (hex.length / 2).toString(16).padStart(2, '0') + hex;
  }
  const firstOnly = MSDDecoder.decode(version2Locations(true, false));
  check('version 2 N-1 only', firstOnly.recent1.longitude === 10 && firstOnly.recent2 === null && firstOnly.point1 !== null && firstOnly.point2 === null && firstOnly.occupants === 2);
  const secondOnly = MSDDecoder.decode(version2Locations(false, true));
  check('version 2 N-2 only keeps relative position unknown', secondOnly.recent1 === null && secondOnly.recent2.longitude === 30 && secondOnly.point1 === null && secondOnly.point2 === null && secondOnly.occupants === 2);
  rejects('reject invalid hex', '03xz');
  rejects('reject truncated message', example.slice(0, -2));
  rejects('reject withdrawn version 1', '01' + example.slice(2));
  rejects('reject unsupported extensions', '032490' + example.slice(6));
  document.getElementById('results').textContent = assertions.map(result => `${result.passed ? 'PASS' : 'FAIL'} ${result.name}`).join('\n');
  document.title = assertions.every(result => result.passed) ? 'PASS' : 'FAIL';
})();