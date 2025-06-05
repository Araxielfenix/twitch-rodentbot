let infoCanal = ""; // Variable compartida

// Exportar las funciones para obtener y actualizar infoCanal
export const getInfoCanal = () => infoCanal;

export const setInfoCanal = (newInfoCanal) => {
    infoCanal = newInfoCanal;
};

export let apiKey = process.env.OPENAI_API_KEY;

export function setApiKey(newKey) {
    apiKey = newKey;
}

// sharedData.js
let userId = null;

export function setUserId(id) {
  userId = id;
}
export function getUserId() {
  return userId;
}
