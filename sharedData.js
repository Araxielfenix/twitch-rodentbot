let infoCanal = ""; // Valor inicial

module.exports = {
    getInfoCanal: () => infoCanal,
    setInfoCanal: (newInfoCanal) => {
        infoCanal = newInfoCanal;
    },
};
