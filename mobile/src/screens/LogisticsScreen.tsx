import React, { useEffect, useState } from 'react';
import { mobileApi } from '../services/api.js';
import { Shipment, User } from '../types/index.js';

interface LogisticsScreenProps {
  user: User;
}

export const LogisticsScreen: React.FC<LogisticsScreenProps> = ({ user }) => {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [newStatus, setNewStatus] = useState<string>('IN_TRANSIT');
  const [statusReason, setStatusReason] = useState<string>('');
  const [updating, setUpdating] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const fetchShipments = async () => {
    setLoading(true);
    try {
      const res = await mobileApi.getShipments();
      setShipments(res.data || res);
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to load shipments', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShipments();
  }, []);

  const handleUpdateStatus = async () => {
    if (!selectedShipment) return;
    setUpdating(true);
    setMessage(null);
    try {
      await mobileApi.updateShipmentStatus(selectedShipment.id, newStatus, statusReason);
      setMessage({ text: `Shipment ${selectedShipment.shipmentRef} status updated to ${newStatus}.`, type: 'success' });
      setSelectedShipment(null);
      setStatusReason('');
      await fetchShipments();
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to update shipment status', type: 'error' });
    } finally {
      setUpdating(false);
    }
  };

  const filteredShipments = shipments.filter(s => {
    const q = search.toLowerCase();
    const ref = (s.shipmentRef || '').toLowerCase();
    const cont = (s.containerNumber || '').toLowerCase();
    const bl = (s.billOfLading || '').toLowerCase();
    return ref.includes(q) || cont.includes(q) || bl.includes(q);
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DELIVERED':
        return { bg: 'rgba(16, 185, 129, 0.15)', text: '#34d399', border: '#059669' };
      case 'IN_TRANSIT':
        return { bg: 'rgba(56, 189, 248, 0.15)', text: '#38bdf8', border: '#0284c7' };
      case 'CUSTOMS_CLEARANCE':
        return { bg: 'rgba(245, 158, 11, 0.15)', text: '#fbbf24', border: '#d97706' };
      default:
        return { bg: 'rgba(148, 163, 184, 0.15)', text: '#94a3b8', border: '#475569' };
    }
  };

  const canEdit = user.roles?.includes('ADMIN') || user.roles?.includes('LOGISTICS');

  return (
    <div style={{ padding: 16, color: '#f8fafc' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <span style={{ fontSize: 12, color: '#94a3b8', textTransform: 'uppercase' }}>Ocean Freight & Cargo</span>
          <h2 style={{ margin: 0, fontSize: 18, color: '#ffffff', fontWeight: 700 }}>Logistics & Containers</h2>
        </div>
        <button
          onClick={fetchShipments}
          style={{
            padding: '8px 12px',
            backgroundColor: '#1e293b',
            border: '1px solid #334155',
            borderRadius: 8,
            color: '#38bdf8',
            fontSize: 12,
            minHeight: 44,
            cursor: 'pointer'
          }}
        >
          🔄 Refresh
        </button>
      </div>

      {message && (
        <div style={{
          padding: 12,
          backgroundColor: message.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
          border: `1px solid ${message.type === 'success' ? '#10b981' : '#ef4444'}`,
          borderRadius: 8,
          color: message.type === 'success' ? '#6ee7b7' : '#fca5a5',
          fontSize: 13,
          marginBottom: 12
        }}>
          {message.text}
        </div>
      )}

      {/* Search Bar */}
      <div style={{ marginBottom: 16 }}>
        <input
          type="text"
          placeholder="Search by container #, BL, or reference..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: '100%',
            padding: '12px 14px',
            minHeight: 44,
            borderRadius: 8,
            backgroundColor: '#0f172a',
            border: '1px solid #334155',
            color: '#ffffff',
            fontSize: 14,
            boxSizing: 'border-box'
          }}
        />
      </div>

      {/* Shipments List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 32, color: '#64748b' }}>Loading logistics tracking...</div>
      ) : filteredShipments.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 32, color: '#64748b', backgroundColor: '#0f172a', borderRadius: 8 }}>
          No active shipments found.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filteredShipments.map(s => {
            const statusStyle = getStatusColor(s.status);
            return (
              <div
                key={s.id}
                style={{
                  backgroundColor: '#0f172a',
                  border: '1px solid #1e293b',
                  borderRadius: 10,
                  padding: 14
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div>
                    <span style={{ fontSize: 15, fontWeight: 700, color: '#ffffff' }}>
                      {s.shipmentRef}
                    </span>
                    <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                      Carrier: <strong style={{ color: '#cbd5e1' }}>{s.carrier || 'Ocean Line'}</strong>
                    </div>
                  </div>
                  <span style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: 12,
                    backgroundColor: statusStyle.bg,
                    color: statusStyle.text,
                    border: `1px solid ${statusStyle.border}`
                  }}>
                    {s.status.replace(/_/g, ' ')}
                  </span>
                </div>

                {/* Container & BL */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, margin: '8px 0', backgroundColor: '#020617', padding: 10, borderRadius: 6 }}>
                  <div>
                    <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>Container Number</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#38bdf8', fontFamily: 'monospace' }}>
                      {s.containerNumber || 'N/A'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>Bill of Lading</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0', fontFamily: 'monospace' }}>
                      {s.billOfLading || 'N/A'}
                    </div>
                  </div>
                </div>

                {/* Route & Dates */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, fontSize: 12, color: '#94a3b8' }}>
                  <div>
                    <span>📍 {s.origin || 'Origin'}</span> → <span>🏁 {s.destination || 'Destination'}</span>
                  </div>
                  {s.estimatedArrivalDate && (
                    <div style={{ fontSize: 11, color: '#fbbf24' }}>
                      ETA: {new Date(s.estimatedArrivalDate).toLocaleDateString()}
                    </div>
                  )}
                </div>

                {canEdit && (
                  <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid #1e293b' }}>
                    <button
                      onClick={() => { setSelectedShipment(s); setNewStatus(s.status); }}
                      style={{
                        width: '100%',
                        minHeight: 40,
                        backgroundColor: '#1e293b',
                        border: '1px solid #334155',
                        borderRadius: 6,
                        color: '#38bdf8',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      ✏️ Update Milestone Status
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Status Update Modal */}
      {selectedShipment && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          zIndex: 100
        }}>
          <div style={{
            backgroundColor: '#0f172a',
            borderTop: '2px solid #334155',
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            padding: 20
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <span style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase' }}>Update Milestone</span>
                <h3 style={{ margin: 0, fontSize: 16, color: '#ffffff' }}>{selectedShipment.shipmentRef}</h3>
              </div>
              <button
                onClick={() => setSelectedShipment(null)}
                style={{ padding: '6px 12px', backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: 6, color: '#ffffff', minHeight: 36, cursor: 'pointer' }}
              >
                ✕ Close
              </button>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', color: '#cbd5e1', fontSize: 12, marginBottom: 6 }}>Milestone Status</label>
              <select
                value={newStatus}
                onChange={e => setNewStatus(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  minHeight: 44,
                  borderRadius: 8,
                  backgroundColor: '#020617',
                  border: '1px solid #334155',
                  color: '#ffffff',
                  fontSize: 14
                }}
              >
                <option value="BOOKED">BOOKED</option>
                <option value="AT_ORIGIN_PORT">AT ORIGIN PORT</option>
                <option value="IN_TRANSIT">IN TRANSIT</option>
                <option value="CUSTOMS_CLEARANCE">CUSTOMS CLEARANCE</option>
                <option value="DELIVERED">DELIVERED</option>
                <option value="CANCELLED">CANCELLED</option>
              </select>
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={{ display: 'block', color: '#cbd5e1', fontSize: 12, marginBottom: 6 }}>Update Note / Location</label>
              <input
                type="text"
                placeholder="e.g. Vessel cleared customs at Port of Jebel Ali"
                value={statusReason}
                onChange={e => setStatusReason(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  minHeight: 44,
                  borderRadius: 8,
                  backgroundColor: '#020617',
                  border: '1px solid #334155',
                  color: '#ffffff',
                  fontSize: 14,
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <button
              disabled={updating}
              onClick={handleUpdateStatus}
              style={{
                width: '100%',
                minHeight: 48,
                backgroundColor: '#059669',
                border: 'none',
                borderRadius: 8,
                color: '#ffffff',
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              {updating ? 'Saving Update...' : 'Save Milestone Status'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
