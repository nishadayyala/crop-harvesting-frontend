import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDownToLine, ArrowRight, BarChart3, Check, ChevronDown, CircleAlert, CircleHelp, Clock3, CloudSun,
  Command, FilePlus2, Filter, Leaf, Menu, MoreHorizontal, Plus, Search, Sprout, Tractor,
  TrendingUp, Wheat, X,
} from 'lucide-react';
import { api } from './api.js';

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
  { id: 'crops', label: 'Manage crops', icon: Sprout },
  { id: 'harvests', label: 'Harvesting records', icon: Wheat },
  { id: 'about', label: 'About project', icon: CircleHelp },
];

const cropBlank = {
  name: '', type: '', variety: '', location: '', area: '', plantingDate: '', expectedHarvest: '', farmerName: '', notes: '',
};
const harvestBlank = {
  cropId: '', farmerName: '', location: '', plannedHarvestDate: '', actualHarvestDate: '', quantity: '', status: 'Pending', notes: '',
};

function getId(item) {
  return item.id ?? item.cropId ?? item.harvestId;
}

function prettyDate(value) {
  if (!value) return '—';
  const date = new Date(`${value}`.length === 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' });
}

function Field({ label, name, value, onChange, type = 'text', required = false, children, placeholder, min }) {
  return (
    <label className="field">
      <span>{label}{required && <b className="required"> *</b>}</span>
      {children || (
        <input name={name} type={type} defaultValue={value} onChange={onChange} required={required} placeholder={placeholder} min={min} />
      )}
    </label>
  );
}

function Modal({ title, onClose, children, onSubmit, submitLabel, busy }) {
  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="modal-heading">
          <div><span className="eyebrow">FIELDWISE WORKSPACE</span><h2 id="modal-title">{title}</h2></div>
          <button className="icon-button" type="button" aria-label="Close dialog" onClick={onClose}><X size={19} /></button>
        </div>
        <form onSubmit={onSubmit}>
          <div className="modal-fields">{children}</div>
          <div className="modal-actions">
            <button className="button button-light" type="button" onClick={onClose}>Cancel</button>
            <button className="button button-primary" type="submit" disabled={busy}>{busy ? <><span className="spinner" /> Saving…</> : submitLabel}</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function EmptyState({ title, detail, action }) {
  return <div className="empty-state"><div className="empty-icon"><Sprout size={23} /></div><h3>{title}</h3><p>{detail}</p>{action}</div>;
}

function App() {
  const [page, setPage] = useState('dashboard');
  const [crops, setCrops] = useState([]);
  const [harvests, setHarvests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All statuses');
  const [toast, setToast] = useState('');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [cropData, harvestData] = await Promise.all([api.getCrops(), api.getHarvests()]);
      setCrops(cropData);
      setHarvests(harvestData);
    } catch (error) {
      setLoadError(error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(''), 3600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const filteredCrops = useMemo(() => crops.filter((crop) => {
    return `${crop.name || ''} ${crop.type || ''} ${crop.variety || ''} ${crop.location || ''} ${crop.farmerName || ''}`
      .toLowerCase().includes(search.toLowerCase());
  }), [crops, search]);
  const filteredHarvests = useMemo(() => harvests.filter((record) => {
    const crop = crops.find((item) => `${getId(item)}` === `${record.cropId}`);
    const matchesSearch = `${record.farmerName || ''} ${record.location || ''} ${crop?.name || ''}`.toLowerCase().includes(search.toLowerCase());
    return matchesSearch && (statusFilter === 'All statuses' || record.status === statusFilter);
  }), [crops, harvests, search, statusFilter]);

  const completedCount = harvests.filter((item) => item.status === 'Completed').length;
  const pendingCount = harvests.filter((item) => item.status === 'Pending').length;
  const latestHarvests = [...harvests].sort((a, b) => `${b.harvestDate || ''}`.localeCompare(`${a.harvestDate || ''}`)).slice(0, 5);

  function showPage(id) {
    setPage(id);
    setSearch('');
    setStatusFilter('All statuses');
    setMobileNavOpen(false);
  }

  function openCropForm(crop = null) {
    setModal({ kind: 'crop', item: crop, values: crop ? { ...cropBlank, ...crop } : { ...cropBlank } });
  }

  function openHarvestForm(record = null) {
    setModal({ kind: 'harvest', item: record, values: record ? { ...harvestBlank, ...record } : { ...harvestBlank } });
  }

  async function submitForm(event) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const data = Object.fromEntries(new FormData(form).entries());
    if (modal.kind === 'crop') {
      data.area = Number(data.area);
    } else {
      data.cropId = Number(data.cropId);
      data.quantity = Number(data.quantity);
    }
    setBusy(true);
    try {
      if (modal.kind === 'crop') {
        if (modal.item) await api.updateCrop(getId(modal.item), data);
        else await api.createCrop(data);
      } else if (modal.item) {
        await api.updateHarvest(getId(modal.item), data);
      } else {
        await api.createHarvest(data);
      }
      setToast(`${modal.kind === 'crop' ? 'Crop' : 'Harvest record'} ${modal.item ? 'updated' : 'added'} successfully.`);
      setModal(null);
      await refresh();
    } catch (error) {
      setToast(`Unable to save: ${error.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function deleteItem(type, item) {
    const label = type === 'crop' ? item.name : `harvest record for ${item.farmerName}`;
    if (!window.confirm(`Delete ${label}? This action cannot be undone.`)) return;
    try {
      if (type === 'crop') await api.deleteCrop(getId(item));
      else await api.deleteHarvest(getId(item));
      setToast(`${type === 'crop' ? 'Crop' : 'Harvest record'} deleted.`);
      await refresh();
    } catch (error) {
      setToast(`Unable to delete: ${error.message}`);
    }
  }

  function renderCropForm() {
    return (
      <Modal title={modal.item ? 'Edit crop' : 'Add a crop'} onClose={() => setModal(null)} onSubmit={submitForm} submitLabel={modal.item ? 'Save changes' : 'Add crop'} busy={busy}>
        <Field label="Crop name" name="name" value={modal.values.name} required placeholder="e.g. Wheat" />
        <Field label="Crop type" name="type" value={modal.values.type} required placeholder="e.g. Cereal" />
        <Field label="Variety" name="variety" value={modal.values.variety} required placeholder="e.g. HD 2967" />
        <Field label="Field location" name="location" value={modal.values.location} required placeholder="Village, district" />
        <Field label="Cultivated area (acres)" name="area" value={modal.values.area} type="number" min="0.01" required placeholder="0.0" />
        <Field label="Sowing date" name="plantingDate" value={modal.values.plantingDate} type="date" required />
        <Field label="Expected harvest date" name="expectedHarvest" value={modal.values.expectedHarvest} type="date" required />
        <Field label="Farmer name" name="farmerName" value={modal.values.farmerName} required placeholder="Full name" />
        <Field label="Notes" name="notes" value={modal.values.notes} placeholder="Optional details" />
      </Modal>
    );
  }

  function renderHarvestForm() {
    return (
      <Modal title={modal.item ? 'Edit harvest record' : 'Record a harvest'} onClose={() => setModal(null)} onSubmit={submitForm} submitLabel={modal.item ? 'Save changes' : 'Save record'} busy={busy}>
        <Field label="Crop" name="cropId" required>
          <select name="cropId" defaultValue={modal.values.cropId} required><option value="">Select a crop</option>{crops.map((crop) => <option key={getId(crop)} value={getId(crop)}>{crop.name}{crop.variety ? ` · ${crop.variety}` : ''}</option>)}</select>
        </Field>
        <Field label="Farmer name" name="farmerName" value={modal.values.farmerName} required placeholder="Full name" />
        <Field label="Farm location" name="location" value={modal.values.location} required placeholder="Village, district" />
        <Field label="Planned harvest date" name="plannedHarvestDate" value={modal.values.plannedHarvestDate} type="date" required />
        <Field label="Actual harvest date" name="actualHarvestDate" value={modal.values.actualHarvestDate} type="date" />
        <Field label="Quantity harvested (kg)" name="quantity" value={modal.values.quantity} type="number" min="0.01" required placeholder="0" />
        <Field label="Record status" name="status">
          <select name="status" defaultValue={modal.values.status}><option>Pending</option><option>Completed</option></select>
        </Field>
        <Field label="Notes" name="notes" value={modal.values.notes} placeholder="Optional details" />
      </Modal>
    );
  }

  const pageTitle = NAV.find((item) => item.id === page)?.label || 'Dashboard';
  const pageSubtitle = {
    dashboard: 'A clear view of what’s growing and what’s ready.',
    crops: 'Keep your crop inventory accurate and up to date.',
    harvests: 'Track every harvest from the field to the record.',
    about: 'A practical digital workspace for growing operations.',
  }[page];

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNavOpen ? 'sidebar-open' : ''}`}>
        <a className="brand" href="#" onClick={(event) => { event.preventDefault(); showPage('dashboard'); }}>
          <span className="brand-mark"><Leaf size={21} strokeWidth={2.5} /></span>
          <span>fieldwise<small>HARVEST MANAGEMENT</small></span>
        </a>
        <div className="workspace-label">WORKSPACE</div>
        <nav className="main-nav" aria-label="Main navigation">
          {NAV.map(({ id, label, icon: Icon }) => (
            <button key={id} className={`nav-link ${page === id ? 'active' : ''}`} onClick={() => showPage(id)}>
              <Icon size={18} strokeWidth={1.9} /><span>{label}</span>{page === id && <span className="nav-indicator" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="weather-card">
            <div className="weather-top"><span><CloudSun size={17} /> FIELD NOTE</span><MoreHorizontal size={17} /></div>
            <strong>Every season starts<br />with a good plan.</strong>
            <span className="weather-caption">Your fields, all in one place.</span>
          </div>
          <div className="sidebar-user"><div className="avatar">FW</div><div><strong>Farm workspace</strong><span>Local operations</span></div><ChevronDown size={16} /></div>
        </div>
      </aside>

      {mobileNavOpen && <button className="mobile-scrim" onClick={() => setMobileNavOpen(false)} aria-label="Close navigation" />}
      <main className="main-area">
        <header className="topbar">
          <button className="icon-button menu-button" aria-label="Open menu" onClick={() => setMobileNavOpen(true)}><Menu size={20} /></button>
          <div className="breadcrumb"><span>Workspace</span><span className="crumb-slash">/</span><strong>{pageTitle}</strong></div>
          <div className="topbar-right"><span className={`connection-dot ${loadError ? 'connection-error' : ''}`} /><span className="connection-label">{loadError ? 'API unavailable' : loading ? 'Connecting to API' : 'API connected'}</span><span className="topbar-divider" /><div className="avatar avatar-small">FW</div></div>
        </header>
        <div className="content">
          <section className="page-heading">
            <div><div className="eyebrow">{new Date().toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' })}</div><h1>{page === 'dashboard' ? 'Good day, farmer' : pageTitle}</h1><p>{pageSubtitle}</p></div>
            <div className="heading-actions">
              {page === 'dashboard' && <button className="button button-light" onClick={() => showPage('harvests')}><ArrowDownToLine size={16} /> View reports</button>}
              {page === 'crops' && <button className="button button-primary" onClick={() => openCropForm()}><Plus size={17} /> Add crop</button>}
              {page === 'harvests' && <button className="button button-primary" onClick={() => openHarvestForm()}><Plus size={17} /> Record harvest</button>}
            </div>
          </section>

          {loadError && <div className="error-banner"><span><strong>Couldn’t load your workspace data.</strong> {loadError}</span><button className="button button-light button-compact" onClick={refresh}>Try again</button></div>}

          {page === 'dashboard' && (
            <>
              <section className="stats-grid" aria-label="Dashboard statistics">
                <StatCard label="Total crops" value={crops.length} note="In your crop inventory" icon={Sprout} color="green" />
                <StatCard label="Harvest records" value={harvests.length} note="Across all seasons" icon={Wheat} color="gold" />
                <StatCard label="Pending tasks" value={pendingCount} note="Need a follow-up" icon={Clock3} color="blue" />
                <StatCard label="Completed tasks" value={completedCount} note="Harvests completed" icon={Check} color="mint" />
              </section>
              <section className="dashboard-grid">
                <div className="panel crops-panel">
                  <div className="panel-heading"><div><span className="eyebrow">YOUR INVENTORY</span><h2>Crop overview</h2></div><button className="text-button" onClick={() => showPage('crops')}>All crops <ArrowRight size={15} /></button></div>
                  {loading ? <LoadingRows /> : crops.length ? <div className="crop-overview-list">{crops.slice(0, 4).map((crop) => <div className="crop-overview-row" key={getId(crop)}><span className="crop-icon"><Wheat size={18} /></span><div className="crop-overview-name"><strong>{crop.name}</strong><span>{crop.variety || 'Variety not set'} · {crop.type || 'Type not set'}</span></div><div className="crop-area">{crop.area ?? '—'} <small>acres</small></div><span className="crop-location">{crop.location || 'Location not set'}</span></div>)}</div> : <EmptyState title="No crops in your inventory" detail="Add your first crop to start tracking the season." action={<button className="button button-primary" onClick={() => openCropForm()}><Plus size={16} /> Add a crop</button>} />}
                </div>
                <div className="panel season-panel">
                  <div className="panel-heading"><div><span className="eyebrow">FIELD SNAPSHOT</span><h2>Crop inventory</h2></div><span className="season-icon"><TrendingUp size={18} /></span></div>
                  <div className="season-number">{crops.length}<span> crop records</span></div>
                  <p className="season-copy">{crops.length ? `You’re tracking ${crops.length} crop record${crops.length === 1 ? '' : 's'} in your inventory.` : 'Add a crop to begin building your inventory.'}</p>
                  <div className="season-divider" />
                  <div className="season-metric"><span><span className="metric-dot green-dot" />Harvest records</span><strong>{harvests.length}</strong></div>
                  <div className="season-metric"><span><span className="metric-dot amber-dot" />Awaiting completion</span><strong>{pendingCount}</strong></div>
                  <button className="season-link" onClick={() => showPage('harvests')}>Explore harvest activity <ArrowRight size={15} /></button>
                </div>
              </section>
              <section className="panel recent-panel">
                <div className="panel-heading"><div><span className="eyebrow">LATEST ACTIVITY</span><h2>Recent harvest records</h2></div><button className="text-button" onClick={() => showPage('harvests')}>View all <ArrowRight size={15} /></button></div>
                {loading ? <LoadingRows /> : latestHarvests.length ? <HarvestTable records={latestHarvests} crops={crops} onEdit={openHarvestForm} onDelete={(item) => deleteItem('harvest', item)} compact /> : <EmptyState title="No harvest activity yet" detail="When you record a harvest, it will show up here." action={<button className="button button-primary" onClick={() => { showPage('harvests'); openHarvestForm(); }}><Plus size={16} /> Record a harvest</button>} />}
              </section>
            </>
          )}

          {page === 'crops' && <section className="panel data-panel">
            <div className="table-toolbar"><div><h2>Crop inventory <span className="count-pill">{crops.length}</span></h2><p>Manage crop details, farmers, and field locations.</p></div><div className="table-controls"><label className="search-field"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search crops…" /></label></div></div>
            {loading ? <LoadingRows /> : filteredCrops.length ? <CropTable crops={filteredCrops} onEdit={openCropForm} onDelete={(item) => deleteItem('crop', item)} /> : <EmptyState title={crops.length ? 'No crops match your search' : 'Your crop inventory is empty'} detail={crops.length ? 'Try a different name or status filter.' : 'Add a crop to keep your fields and seasons organized.'} action={!crops.length && <button className="button button-primary" onClick={() => openCropForm()}><Plus size={16} /> Add a crop</button>} />}
          </section>}

          {page === 'harvests' && <section className="panel data-panel">
            <div className="table-toolbar"><div><h2>Harvest records <span className="count-pill">{harvests.length}</span></h2><p>Review and update completed and pending harvests.</p></div><div className="table-controls"><label className="search-field"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search records…" /></label><label className="filter-field"><Filter size={15} /><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>All statuses</option><option>Pending</option><option>Completed</option></select></label></div></div>
            {loading ? <LoadingRows /> : filteredHarvests.length ? <HarvestTable records={filteredHarvests} crops={crops} onEdit={openHarvestForm} onDelete={(item) => deleteItem('harvest', item)} /> : <EmptyState title={harvests.length ? 'No records match your search' : 'No harvests recorded yet'} detail={harvests.length ? 'Try a different farmer, location, or status.' : 'Create your first record to track a harvest.'} action={!harvests.length && <button className="button button-primary" onClick={() => openHarvestForm()}><Plus size={16} /> Record a harvest</button>} />}
          </section>}

          {page === 'about' && <AboutPage />}
          <footer className="footer"><span><Leaf size={14} /> Growing better, one season at a time.</span><span>FIELDWISE · CROP HARVESTING SYSTEM</span></footer>
        </div>
      </main>
      {modal?.kind === 'crop' && renderCropForm()}
      {modal?.kind === 'harvest' && renderHarvestForm()}
      {toast && <div className={`toast ${toast.startsWith('Unable') ? 'toast-error' : ''}`} role="status"><span className="toast-check">{toast.startsWith('Unable') ? <CircleAlert size={15} /> : <Check size={15} />}</span>{toast}<button onClick={() => setToast('')} aria-label="Dismiss"><X size={15} /></button></div>}
    </div>
  );
}

function StatCard({ label, value, note, icon: Icon, color }) {
  return <article className="stat-card"><div className={`stat-icon ${color}`}><Icon size={19} /></div><div className="stat-label">{label}<span className="stat-trend"><TrendingUp size={13} /></span></div><div className="stat-value">{value}</div><div className="stat-note">{note}</div></article>;
}

function StatusBadge({ status }) {
  const normalized = `${status}`.toLowerCase().replaceAll(' ', '-');
  return <span className={`status-badge status-${normalized}`}><span />{status}</span>;
}

function LoadingRows() {
  return <div className="loading-state"><span className="spinner spinner-dark" />Loading workspace data…</div>;
}

function RowActions({ item, onEdit, onDelete }) {
  return <div className="row-actions"><button type="button" onClick={() => onEdit(item)} aria-label="Edit record" title="Edit"><FilePlus2 size={16} /></button><button type="button" onClick={() => onDelete(item)} aria-label="Delete record" title="Delete"><X size={17} /></button></div>;
}

function CropTable({ crops, onEdit, onDelete }) {
  return <div className="table-scroll"><table><thead><tr><th>Crop</th><th>Farmer</th><th>Field location</th><th>Area</th><th>Sowing date</th><th>Expected harvest</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>
    {crops.map((crop) => <tr key={getId(crop)}><td><div className="table-crop"><span className="crop-icon"><Wheat size={17} /></span><div><strong>{crop.name || 'Unnamed crop'}</strong><small>{[crop.type, crop.variety].filter(Boolean).join(' · ') || '—'}</small></div></div></td><td>{crop.farmerName || '—'}</td><td>{crop.location || '—'}</td><td>{crop.area ?? '—'} acres</td><td>{prettyDate(crop.plantingDate)}</td><td>{prettyDate(crop.expectedHarvest)}</td><td><RowActions item={crop} onEdit={onEdit} onDelete={onDelete} /></td></tr>)}
  </tbody></table></div>;
}

function HarvestTable({ records, crops, onEdit, onDelete, compact = false }) {
  return <div className="table-scroll"><table><thead><tr><th>Crop</th><th>Farmer</th><th>Location</th><th>Harvest date</th><th>Quantity</th><th>Status</th>{!compact && <th><span className="sr-only">Actions</span></th>}</tr></thead><tbody>
    {records.map((record) => {
      const crop = crops.find((item) => `${getId(item)}` === `${record.cropId}`);
      return <tr key={getId(record)}><td><div className="table-crop"><span className="crop-icon crop-icon-pale"><Wheat size={17} /></span><div><strong>{crop?.name || record.cropName || 'Unknown crop'}</strong><small>{crop?.variety || 'Harvest record'}</small></div></div></td><td>{record.farmerName || '—'}</td><td>{record.location || '—'}</td><td>{prettyDate(record.harvestDate)}</td><td><strong className="quantity">{record.quantity ?? '—'} kg</strong></td><td><StatusBadge status={record.status || 'Unknown'} /></td>{!compact && <td><RowActions item={record} onEdit={onEdit} onDelete={onDelete} /></td>}</tr>;
    })}
  </tbody></table></div>;
}

function AboutPage() {
  return <div className="about-layout">
    <section className="about-hero panel"><div className="about-illustration"><div className="sun-disc" /><div className="field-line field-one" /><div className="field-line field-two" /><div className="field-stem"><span /><span /><span /></div><Sprout className="hero-sprout" size={76} strokeWidth={1.2} /></div><div className="about-copy"><span className="eyebrow">ABOUT FIELDWISE</span><h2>Better visibility.<br /><em>Healthier harvests.</em></h2><p>Fieldwise brings crop planning and harvest records into one calm, practical workspace. Keep essential details close, so you can focus on the work happening in the field.</p></div></section>
    <section className="about-cards"><article className="panel about-card"><span className="about-card-icon"><Sprout size={19} /></span><h3>Crop management</h3><p>Record crop type, variety, field location, farmer, sowing date, and expected harvest date.</p></article><article className="panel about-card"><span className="about-card-icon icon-amber"><Tractor size={19} /></span><h3>Harvest tracking</h3><p>Connect planned and actual harvests to crops, farmers, locations, quantities, and status.</p></article><article className="panel about-card"><span className="about-card-icon icon-blue"><Command size={19} /></span><h3>Built for your workflow</h3><p>This frontend connects directly to your Spring Boot API; your backend remains the source of truth.</p></article></section>
    <div className="about-note"><span className="about-note-mark"><CircleHelp size={17} /></span><div><strong>Backend API integration</strong><p>Crop data uses <code>/api/crops</code>; harvest records use <code>/api/harvests</code>. The Vite development server proxies requests to the Spring Boot service.</p></div></div>
  </div>;
}

export default App;
