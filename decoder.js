(function (root) {
  'use strict';

  const alphabet = '0123456789ABCDEFGHJKLMNPRSTUVWXYZ';
  const vehicleTypes = [
    'Passenger vehicle (M1)', 'Bus or coach (M2)', 'Bus or coach (M3)',
    'Light commercial vehicle (N1)', 'Heavy duty vehicle (N2)', 'Heavy duty vehicle (N3)',
    'Motorcycle (L1e)', 'Three-wheeled vehicle (L2e)', 'Motorcycle (L3e)',
    'Three-wheeled vehicle (L4e)', 'Three-wheeled vehicle (L5e)',
    'Light quadricycle (L6e)', 'Heavy quadricycle (L7e)', 'Trailer (O)',
    'Agricultural vehicle (R)', 'Agricultural vehicle (S)', 'Agricultural vehicle (T)',
    'Off-road vehicle (G)', 'Motor caravan (SA)', 'Armoured vehicle (SB)',
    'Ambulance (SC)', 'Hearse (SD)', 'Other vehicle'
  ];
  const propulsionNames = ['Gasoline', 'Diesel', 'Compressed natural gas', 'LPG', 'Electric', 'Hydrogen', 'Other'];

  class BitReader {
    constructor(bytes) { this.bytes = bytes; this.offset = 0; }
    read(count) {
      if (this.offset + count > this.bytes.length * 8) throw new Error('The MSD is truncated.');
      let value = 0;
      for (let index = 0; index < count; index++) {
        value = value * 2 + ((this.bytes[this.offset >> 3] >> (7 - (this.offset & 7))) & 1);
        this.offset++;
      }
      return value;
    }
    length() {
      const first = this.read(8);
      if (first < 128) return first;
      if (first < 192) return (first - 128) * 256 + this.read(8);
      throw new Error('Fragmented lengths are not supported.');
    }
    octets(count) { return Array.from({ length: count }, () => this.read(8)); }
  }

  function parseHex(input) {
    const text = input.replace(/\s+/g, '');
    if (!text || text.length % 2 || !/^[0-9a-f]+$/i.test(text)) throw new Error('Enter complete hexadecimal bytes (spaces and line breaks are allowed).');
    return Uint8Array.from(text.match(/../g), byte => parseInt(byte, 16));
  }

  function decode(input) {
    const bytes = parseHex(input);
    const outer = new BitReader(bytes);
    const version = outer.read(8);
    if (version !== 2 && version !== 3) throw new Error(`MSD version ${version} is not supported. This decoder supports versions 2 and 3.`);
    const length = outer.length();
    if (outer.offset / 8 + length > 140) throw new Error('The encoded MSD exceeds 140 bytes.');
    const payload = outer.octets(length);
    const reader = new BitReader(payload);
    const messageExtension = reader.read(1);
    const hasAdditional = reader.read(1);
    const structureExtension = reader.read(1);
    const hasRecent1 = version === 2 ? Boolean(reader.read(1)) : true;
    const hasRecent2 = version === 2 ? Boolean(reader.read(1)) : true;
    const hasOccupants = reader.read(1);
    if (messageExtension || structureExtension) throw new Error('This MSD contains unsupported ASN.1 extensions.');
    const messageIdentifier = reader.read(8);
    const automatic = Boolean(reader.read(1));
    const test = Boolean(reader.read(1));
    const trusted = Boolean(reader.read(1));
    if (reader.read(1)) throw new Error('This MSD contains an unsupported vehicle type extension.');
    const vehicleIndex = reader.read(version === 2 ? 4 : 5);
    if (vehicleIndex >= (version === 2 ? 13 : vehicleTypes.length)) throw new Error('Invalid vehicle type.');
    let vin = '';
    for (let index = 0; index < 17; index++) {
      const character = reader.read(6);
      if (character >= alphabet.length) throw new Error('Invalid VIN character.');
      vin += alphabet[character];
    }
    if (reader.read(1)) throw new Error('This MSD contains unsupported propulsion extensions.');
    const propulsionPresent = propulsionNames.map(() => Boolean(reader.read(1)));
    const propulsion = propulsionNames.filter((name, index) => propulsionPresent[index] && reader.read(1));
    const timestamp = reader.read(32);
    const latitude = reader.read(32) - 2147483648;
    const longitude = reader.read(32) - 2147483648;
    const direction = reader.read(8);
    if (direction > 179 && direction !== 255) throw new Error('Invalid vehicle direction.');
    const recent1 = hasRecent1 ? { latitude: reader.read(10) - 512, longitude: reader.read(10) - 512 } : null;
    const recent2 = hasRecent2 ? { latitude: reader.read(10) - 512, longitude: reader.read(10) - 512 } : null;
    const occupants = hasOccupants ? reader.read(8) : null;
    let additional = null;
    if (hasAdditional) {
      const oidBytes = reader.octets(reader.length());
      const arcs = [];
      let arc = 0;
      for (const byte of oidBytes) {
        arc = arc * 128 + (byte & 127);
        if (!Number.isSafeInteger(arc)) throw new Error('Additional data OID is too large.');
        if (!(byte & 128)) { arcs.push(arc); arc = 0; }
      }
      if (!oidBytes.length || oidBytes[oidBytes.length - 1] & 128) throw new Error('Invalid additional data OID.');
      const data = reader.octets(reader.length());
      additional = { oid: arcs.join('.'), data: data.map(byte => byte.toString(16).padStart(2, '0')).join('').toUpperCase() };
    }
    const validPosition = latitude !== 2147483647 && longitude !== 2147483647 &&
      Math.abs(latitude) <= 324000000 && Math.abs(longitude) <= 648000000 && !(latitude === 0 && longitude === 0);
    const position = validPosition ? { latitude: latitude / 3600000, longitude: longitude / 3600000 } : null;
    const point1 = position && recent1 ? { latitude: (latitude + recent1.latitude * 100) / 3600000, longitude: (longitude + recent1.longitude * 100) / 3600000 } : null;
    const point2 = point1 && recent2 ? { latitude: point1.latitude + recent2.latitude / 36000, longitude: point1.longitude + recent2.longitude / 36000 } : null;
    return { version, messageIdentifier, automatic, test, trusted, vehicleType: vehicleTypes[vehicleIndex], vin,
      propulsion, timestamp, latitude, longitude, direction, recent1, recent2, occupants, additional,
      position, point1, point2, encodedBytes: outer.offset / 8, ignoredBytes: bytes.length - outer.offset / 8 };
  }

  root.MSDDecoder = { decode };
})(typeof globalThis !== 'undefined' ? globalThis : this);