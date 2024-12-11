let infoCanal = ""; // Variable compartida

// Exportar las funciones para obtener y actualizar infoCanal
export const getInfoCanal = () => infoCanal;

export const setInfoCanal = (newInfoCanal) => {
    infoCanal = newInfoCanal;
    console.log(`infoCanal actualizado a: ${infoCanal}`);
};
