const isoDate = (year, month, day) => `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

export const LOCAL_DEMO_PERSONNEL = {
  id: 'local-demo-person-1',
  full_name: 'Ahmet Yılmaz',
  tc_number: '12345678901',
  company: 'Örnek Liman Operasyon',
  phone: '0555 111 22 33',
  license_plate: '31 DEM 01',
  assignment_start: isoDate(2026, 7, 28),
  assignment_end: isoDate(2027, 7, 28),
  overall_status: 'green',
  can_enter: true,
};

export const LOCAL_DEMO_DOCUMENT_TYPES = [
  { id: 'demo-health', name_tr: 'Sağlık Raporu', name_en: 'Health Report', is_mandatory: true, warning_days: 30 },
  { id: 'demo-safety', name_tr: 'Temel İSG Eğitimi', name_en: 'Basic OHS Training', is_mandatory: true, warning_days: 30 },
  { id: 'demo-site', name_tr: 'Saha Tanıtım Eğitimi', name_en: 'Site Orientation Training', is_mandatory: true, warning_days: 30 },
];

const makeDocument = (id, documentType, expiryDate, daysUntilExpiry, status) => ({
  id,
  personnel_id: LOCAL_DEMO_PERSONNEL.id,
  document_type_id: documentType.id,
  document_type: documentType,
  expiry_date: expiryDate,
  notes: '',
  days_until_expiry: daysUntilExpiry,
  status,
});

export const createLocalDemoDetail = () => ({
  personnel: { ...LOCAL_DEMO_PERSONNEL },
  documents: [
    makeDocument('demo-doc-health', LOCAL_DEMO_DOCUMENT_TYPES[0], isoDate(2027, 1, 31), 186, 'valid'),
    makeDocument('demo-doc-safety', LOCAL_DEMO_DOCUMENT_TYPES[1], isoDate(2027, 1, 30), 185, 'valid'),
    makeDocument('demo-doc-site', LOCAL_DEMO_DOCUMENT_TYPES[2], isoDate(2026, 7, 30), 1, 'warning'),
  ],
  overall_status: 'green',
  status_reason: 'all_valid',
  assignment_expired: false,
  assignment_not_started: false,
  restriction_reasons: [],
});

export const isLocalPreviewHost = () => ['localhost', '127.0.0.1'].includes(window.location.hostname);
