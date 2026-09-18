/**
 * Centralized Delivery Areas Configuration
 * Enables extensible city-based PIN code validation for French Roast deliveries.
 */

export const deliveryConfig = {
  cities: {
    bengaluru: {
      name: 'Bengaluru',
      enabled: true,
      pincodes: [
        // Main Bengaluru City PIN Codes (560001 - 560109)
        '560001', '560002', '560003', '560004', '560005', '560006', '560007', '560008', '560009', '560010',
        '560011', '560012', '560013', '560014', '560015', '560016', '560017', '560018', '560019', '560020',
        '560021', '560022', '560023', '560024', '560025', '560026', '560027', '560028', '560029', '560030',
        '560031', '560032', '560033', '560034', '560035', '560036', '560037', '560038', '560039', '560040',
        '560041', '560042', '560043', '560044', '560045', '560046', '560047', '560048', '560049', '560050',
        '560051', '560052', '560053', '560054', '560055', '560056', '560057', '560058', '560059', '560060',
        '560061', '560062', '560063', '560064', '560065', '560066', '560067', '560068', '560069', '560070',
        '560071', '560072', '560073', '560074', '560075', '560076', '560077', '560078', '560079', '560080',
        '560081', '560082', '560083', '560084', '560085', '560086', '560087', '560088', '560089', '560090',
        '560091', '560092', '560093', '560094', '560095', '560096', '560097', '560098', '560099', '560100',
        '560101', '560102', '560103', '560104', '560105', '560106', '560107', '560108', '560109', '560110',
        '560111', '560112', '560113', '560114', '560115',
        // Bengaluru Urban & Rural Extension Zones
        '562106', '562107', '562110', '562125', '562129', '562130', '562149', '562157', '562162'
      ]
    },
    // Future expansion slots (disabled for now)
    mysuru: {
      name: 'Mysuru',
      enabled: false,
      pincodes: []
    },
    hyderabad: {
      name: 'Hyderabad',
      enabled: false,
      pincodes: []
    }
  }
};

// Set of fast lookup Bengaluru PIN codes
const bengaluruPincodeSet = new Set(deliveryConfig.cities.bengaluru.pincodes);

/**
 * Normalizes input PIN string
 */
export const normalizePincode = (pincode) => {
  return String(pincode || '').replace(/\s+/g, '').trim();
};

/**
 * Validates if a PIN code is 6 numeric digits
 */
export const isValidPincodeFormat = (pincode) => {
  const clean = normalizePincode(pincode);
  return /^[0-9]{6}$/.test(clean);
};

/**
 * Primary delivery location validation function
 * Returns structured validation result
 */
export const validateDeliveryLocation = (pincode) => {
  const cleanPin = normalizePincode(pincode);

  if (!cleanPin || !isValidPincodeFormat(cleanPin)) {
    return {
      valid: false,
      code: 'INVALID_PIN_FORMAT',
      message: 'Please enter a valid 6-digit PIN code.'
    };
  }

  if (bengaluruPincodeSet.has(cleanPin)) {
    return {
      valid: true,
      code: 'DELIVERY_AVAILABLE',
      area: 'Bengaluru',
      pinCode: cleanPin,
      message: '✓ Bengaluru delivery available'
    };
  }

  return {
    valid: false,
    code: 'OUTSIDE_DELIVERY_AREA',
    message: 'Sorry, French Roast currently delivers only within Bengaluru.'
  };
};

export const isPincodeInBengaluru = (pincode) => {
  const res = validateDeliveryLocation(pincode);
  return res.valid && res.area === 'Bengaluru';
};
