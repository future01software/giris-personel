/**
 * Rastgele 11 haneli TC Kimlik No üretir.
 * Algoritma doğrulaması yapmaz, sadece rastgele 11 rakam üretir.
 * İstenirse ileride geçerli TC algoritmasına göre güncellenebilir.
 */
export const generateRandomTC = () => {
    let tc = '';
    // İlk hane 0 olamaz
    tc += Math.floor(Math.random() * 9) + 1;

    for (let i = 0; i < 10; i++) {
        tc += Math.floor(Math.random() * 10);
    }

    return tc;
};
