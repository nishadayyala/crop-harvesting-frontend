const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new Error(`Unable to reach the API at ${API_BASE_URL}. Check that the backend is running and reachable.`);
  }

  if (!response.ok) {
    const body = await response.text();
    let details = body.trim().slice(0, 300);
    if ((response.headers.get('content-type') || '').includes('application/json') && body) {
      try {
        const payload = JSON.parse(body);
        details = payload.message || Object.values(payload).filter((value) => typeof value === 'string').join(' ') || details;
      } catch {
        // Keep the response text when the server's JSON error body is malformed.
      }
    }
    throw new Error(details || `The server returned ${response.status} ${response.statusText}.`);
  }

  if (response.status === 204) return null;
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) return null;
  return response.json();
}

function toList(payload, resource) {
  const items = Array.isArray(payload) ? payload : payload?.content;
  if (!Array.isArray(items)) {
    throw new Error(`The ${resource} endpoint did not return a list or a Spring page with a content array.`);
  }
  return items;
}

function normalizeCrop(crop) {
  return {
    ...crop,
    name: crop.cropName,
    type: crop.cropType,
    variety: crop.cropVariety,
    location: crop.fieldLocation,
    area: crop.cultivatedArea,
    plantingDate: crop.sowingDate,
    expectedHarvest: crop.expectedHarvestDate,
  };
}

function normalizeHarvest(record) {
  return {
    ...record,
    cropId: record.cropId ?? record.crop?.id,
    cropName: record.cropName ?? record.crop?.cropName,
    location: record.fieldLocation,
    harvestDate: record.actualHarvestDate || record.plannedHarvestDate,
    quantity: record.harvestedQuantity,
  };
}

function cropRequest(crop) {
  return {
    cropName: crop.name,
    cropType: crop.type,
    cropVariety: crop.variety,
    fieldLocation: crop.location,
    cultivatedArea: Number(crop.area),
    sowingDate: crop.plantingDate,
    expectedHarvestDate: crop.expectedHarvest,
    farmerName: crop.farmerName,
    notes: crop.notes || null,
  };
}

function harvestRequest(harvest) {
  return {
    cropId: Number(harvest.cropId),
    farmerName: harvest.farmerName,
    fieldLocation: harvest.location,
    plannedHarvestDate: harvest.plannedHarvestDate,
    actualHarvestDate: harvest.actualHarvestDate || null,
    harvestedQuantity: Number(harvest.quantity),
    status: harvest.status,
    notes: harvest.notes || null,
  };
}

export const api = {
  async getCrops() {
    return toList(await request('/crops'), 'crops').map(normalizeCrop);
  },
  async createCrop(crop) {
    return request('/crops', { method: 'POST', body: JSON.stringify(cropRequest(crop)) });
  },
  async updateCrop(id, crop) {
    return request(`/crops/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(cropRequest(crop)),
    });
  },
  async deleteCrop(id) {
    return request(`/crops/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },
  async getHarvests() {
    return toList(await request('/harvests'), 'harvesting records').map(normalizeHarvest);
  },
  async createHarvest(harvest) {
    return request('/harvests', { method: 'POST', body: JSON.stringify(harvestRequest(harvest)) });
  },
  async updateHarvest(id, harvest) {
    return request(`/harvests/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(harvestRequest(harvest)),
    });
  },
  async deleteHarvest(id) {
    return request(`/harvests/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },
};
