import axios from "axios";

const API = "http://127.0.0.1:8000";

const getToken = () => localStorage.getItem("token");

const headers = () => ({
  Authorization: `Bearer ${getToken()}`
});

export const exchangeAPI = {

  // =========================
  // GET ALL PAIRS
  // =========================
  getPairs: async () => {
    const res = await axios.get(
      `${API}/admin/exchange/`,
      { headers: headers() }
    );
    return res.data;
  },

  // =========================
  // CREATE PAIR
  // =========================
  createPair: async (data) => {
    const res = await axios.post(
      `${API}/admin/exchange/`,
      data,
      { headers: headers() }
    );
    return res.data;
  },

  // =========================
  // UPDATE PAIR (RATE, FEE, LIMITS, ACTIVE)
  // =========================
  updatePair: async (pairId, data) => {
    const res = await axios.put(
      `${API}/admin/exchange/${pairId}`,
      data,
      { headers: headers() }
    );
    return res.data;
  },

  // =========================
  // DELETE PAIR
  // =========================
  deletePair: async (pairId) => {
    const res = await axios.delete(
      `${API}/admin/exchange/${pairId}`,
      { headers: headers() }
    );
    return res.data;
  },

  // =========================
  // TOGGLE ACTIVE STATUS
  // =========================
  togglePair: async (pair) => {
    const res = await axios.put(
      `${API}/admin/exchange/${pair.id}`,
      {
        is_active: !pair.is_active
      },
      { headers: headers() }
    );
    return res.data;
  }

};