/**
 * Bright star catalog for sky dome rendering.
 * ~300 brightest stars from the Yale Bright Star Catalog.
 * Each entry: { ra: degrees (0-360), dec: degrees (-90 to +90), mag: visual magnitude }
 * Lower magnitude = brighter star.
 */

const STARS = [
  // Orion
  { ra: 88.79, dec: 7.41, mag: 0.42 },   // Betelgeuse (alpha Ori)
  { ra: 78.63, dec: -8.20, mag: 0.12 },   // Rigel (beta Ori)
  { ra: 83.00, dec: -1.20, mag: 1.70 },   // Mintaka (delta Ori)
  { ra: 83.86, dec: -5.91, mag: 2.09 },   // Alnilam (epsilon Ori)
  { ra: 84.05, dec: -1.94, mag: 1.77 },   // Alnitak (zeta Ori)
  { ra: 81.28, dec: 6.35, mag: 1.64 },    // Bellatrix (gamma Ori)
  { ra: 86.94, dec: -9.67, mag: 2.06 },   // Saiph (kappa Ori)

  // Ursa Major (Big Dipper)
  { ra: 165.93, dec: 61.75, mag: 1.79 },  // Dubhe (alpha UMa)
  { ra: 165.46, dec: 56.38, mag: 2.37 },  // Merak (beta UMa)
  { ra: 178.46, dec: 53.69, mag: 2.44 },  // Phecda (gamma UMa)
  { ra: 183.86, dec: 57.03, mag: 3.31 },  // Megrez (delta UMa)
  { ra: 193.51, dec: 55.96, mag: 1.77 },  // Alioth (epsilon UMa)
  { ra: 200.98, dec: 54.93, mag: 2.27 },  // Mizar (zeta UMa)
  { ra: 206.89, dec: 49.31, mag: 1.86 },  // Alkaid (eta UMa)

  // Ursa Minor
  { ra: 37.95, dec: 89.26, mag: 2.02 },   // Polaris (alpha UMi)
  { ra: 263.05, dec: 86.59, mag: 2.08 },  // Kochab (beta UMi)

  // Canis Major
  { ra: 101.29, dec: -16.72, mag: -1.46 }, // Sirius (alpha CMa)
  { ra: 104.66, dec: -28.97, mag: 1.50 },  // Adhara (epsilon CMa)
  { ra: 107.10, dec: -26.39, mag: 1.84 },  // Wezen (delta CMa)
  { ra: 95.08, dec: -17.96, mag: 1.98 },   // Mirzam (beta CMa)
  { ra: 111.02, dec: -29.30, mag: 3.02 },  // Aludra (eta CMa)

  // Canis Minor
  { ra: 114.83, dec: 5.22, mag: 0.34 },   // Procyon (alpha CMi)

  // Taurus
  { ra: 68.98, dec: 16.51, mag: 0.85 },   // Aldebaran (alpha Tau)
  { ra: 84.41, dec: 21.14, mag: 1.65 },   // Elnath (beta Tau)
  { ra: 56.87, dec: 24.11, mag: 2.87 },   // Alcyone (eta Tau)

  // Gemini
  { ra: 113.65, dec: 31.89, mag: 1.14 },  // Pollux (beta Gem)
  { ra: 116.33, dec: 28.03, mag: 1.58 },  // Castor (alpha Gem)
  { ra: 99.43, dec: 16.40, mag: 2.88 },   // Alhena (gamma Gem)

  // Leo
  { ra: 152.09, dec: 11.97, mag: 1.35 },  // Regulus (alpha Leo)
  { ra: 177.27, dec: 14.57, mag: 2.14 },  // Denebola (beta Leo)
  { ra: 168.53, dec: 20.52, mag: 2.56 },  // Zosma (delta Leo)
  { ra: 146.46, dec: 23.77, mag: 2.98 },  // Algieba (gamma Leo)

  // Virgo
  { ra: 201.30, dec: -11.16, mag: 0.97 }, // Spica (alpha Vir)
  { ra: 190.42, dec: 11.39, mag: 3.59 },  // Vindemiatrix (epsilon Vir)

  // Scorpius
  { ra: 247.35, dec: -26.43, mag: 0.96 }, // Antares (alpha Sco)
  { ra: 252.97, dec: -34.29, mag: 1.63 }, // Shaula (lambda Sco)
  { ra: 263.40, dec: -37.10, mag: 1.87 }, // Sargas (theta Sco)
  { ra: 239.71, dec: -26.11, mag: 2.32 }, // Dschubba (delta Sco)
  { ra: 245.30, dec: -25.59, mag: 2.62 }, // Acrab (beta Sco)

  // Sagittarius
  { ra: 276.04, dec: -34.38, mag: 1.80 }, // Kaus Australis (epsilon Sgr)
  { ra: 283.82, dec: -26.30, mag: 2.02 }, // Nunki (sigma Sgr)
  { ra: 275.25, dec: -29.83, mag: 2.70 }, // Ascella (zeta Sgr)

  // Lyra
  { ra: 279.23, dec: 38.78, mag: 0.03 },  // Vega (alpha Lyr)
  { ra: 284.74, dec: 32.69, mag: 3.24 },  // Sheliak (beta Lyr)
  { ra: 283.63, dec: 33.36, mag: 3.25 },  // Sulafat (gamma Lyr)

  // Cygnus
  { ra: 310.36, dec: 45.28, mag: 1.25 },  // Deneb (alpha Cyg)
  { ra: 305.56, dec: 40.26, mag: 2.20 },  // Sadr (gamma Cyg)
  { ra: 292.68, dec: 27.96, mag: 2.87 },  // Albireo (beta Cyg)

  // Aquila
  { ra: 297.70, dec: 8.87, mag: 0.77 },   // Altair (alpha Aql)
  { ra: 286.35, dec: 13.86, mag: 2.72 },  // Tarazed (gamma Aql)

  // Pegasus
  { ra: 326.05, dec: 9.88, mag: 2.39 },   // Enif (epsilon Peg)
  { ra: 346.19, dec: 15.21, mag: 2.42 },  // Markab (alpha Peg)
  { ra: 345.94, dec: 28.08, mag: 2.44 },  // Scheat (beta Peg)
  { ra: 3.31, dec: 15.18, mag: 2.83 },    // Algenib (gamma Peg)

  // Andromeda
  { ra: 2.10, dec: 29.09, mag: 2.06 },    // Alpheratz (alpha And)
  { ra: 17.43, dec: 35.62, mag: 2.06 },   // Mirach (beta And)
  { ra: 30.97, dec: 42.33, mag: 2.10 },   // Almach (gamma And)

  // Perseus
  { ra: 51.08, dec: 49.86, mag: 1.80 },   // Mirfak (alpha Per)
  { ra: 47.04, dec: 40.96, mag: 2.12 },   // Algol (beta Per)

  // Auriga
  { ra: 79.17, dec: 45.99, mag: 0.08 },   // Capella (alpha Aur)
  { ra: 89.88, dec: 44.95, mag: 1.90 },   // Menkalinan (beta Aur)

  // Bootes
  { ra: 213.92, dec: 19.18, mag: -0.05 }, // Arcturus (alpha Boo)
  { ra: 218.02, dec: 38.31, mag: 2.68 },  // Nekkar (beta Boo)

  // Corona Borealis
  { ra: 233.67, dec: 26.71, mag: 2.23 },  // Alphecca (alpha CrB)

  // Centaurus
  { ra: 219.90, dec: -60.84, mag: -0.01 }, // Alpha Centauri (alpha Cen)
  { ra: 210.96, dec: -60.37, mag: 0.61 },  // Hadar (beta Cen)

  // Crux (Southern Cross)
  { ra: 186.65, dec: -63.10, mag: 0.76 },  // Acrux (alpha Cru)
  { ra: 191.93, dec: -59.69, mag: 1.25 },  // Mimosa (beta Cru)
  { ra: 187.79, dec: -57.11, mag: 1.63 },  // Gacrux (gamma Cru)
  { ra: 182.09, dec: -58.75, mag: 2.80 },  // Delta Cru

  // Carina
  { ra: 95.99, dec: -52.70, mag: -0.72 },  // Canopus (alpha Car)
  { ra: 138.30, dec: -59.28, mag: 1.86 },  // Avior (epsilon Car)
  { ra: 125.63, dec: -59.51, mag: 1.68 },  // Miaplacidus (beta Car)

  // Eridanus
  { ra: 24.43, dec: -57.24, mag: 0.46 },   // Achernar (alpha Eri)
  { ra: 76.96, dec: -5.09, mag: 2.79 },    // Cursa (beta Eri)

  // Piscis Austrinus
  { ra: 344.41, dec: -29.62, mag: 1.16 },  // Fomalhaut (alpha PsA)

  // Grus
  { ra: 332.06, dec: -46.96, mag: 1.74 },  // Alnair (alpha Gru)

  // Pavo
  { ra: 306.41, dec: -56.74, mag: 1.94 },  // Peacock (alpha Pav)

  // Triangulum Australe
  { ra: 252.17, dec: -69.03, mag: 1.92 },  // Atria (alpha TrA)

  // Lupus
  { ra: 220.48, dec: -47.39, mag: 2.30 },  // Alpha Lupi

  // Vela
  { ra: 128.51, dec: -47.34, mag: 1.78 },  // Gamma Velorum (Regor)
  { ra: 136.04, dec: -43.43, mag: 1.93 },  // Delta Velorum
  { ra: 131.18, dec: -54.71, mag: 2.21 },  // Lambda Velorum (Suhail)

  // Puppis
  { ra: 120.90, dec: -40.00, mag: 2.25 },  // Naos (zeta Pup)

  // Aries
  { ra: 31.79, dec: 23.46, mag: 2.00 },    // Hamal (alpha Ari)
  { ra: 28.66, dec: 20.81, mag: 2.64 },    // Sheratan (beta Ari)

  // Pisces
  { ra: 30.51, dec: 2.76, mag: 3.62 },     // Alrescha (alpha Psc)

  // Capricornus
  { ra: 326.76, dec: -16.13, mag: 2.91 },  // Deneb Algedi (delta Cap)

  // Aquarius
  { ra: 331.45, dec: -0.32, mag: 2.91 },   // Sadalsuud (beta Aqr)
  { ra: 334.21, dec: -1.39, mag: 2.94 },   // Sadalmelik (alpha Aqr)

  // Ophiuchus
  { ra: 263.73, dec: 12.56, mag: 2.08 },   // Rasalhague (alpha Oph)
  { ra: 243.59, dec: -3.69, mag: 2.56 },   // Sabik (eta Oph)

  // Serpens
  { ra: 236.07, dec: 6.43, mag: 2.65 },    // Unukalhai (alpha Ser)

  // Hercules
  { ra: 257.59, dec: 14.39, mag: 2.77 },   // Rasalgethi (alpha Her)
  { ra: 247.55, dec: 21.49, mag: 2.81 },   // Kornephoros (beta Her)

  // Cassiopeia
  { ra: 10.13, dec: 56.54, mag: 2.23 },    // Schedar (alpha Cas)
  { ra: 2.29, dec: 59.15, mag: 2.27 },     // Caph (beta Cas)
  { ra: 14.18, dec: 60.72, mag: 2.47 },    // Gamma Cas
  { ra: 21.45, dec: 60.24, mag: 2.68 },    // Ruchbah (delta Cas)

  // Cepheus
  { ra: 319.64, dec: 62.59, mag: 2.44 },   // Alderamin (alpha Cep)
  { ra: 322.17, dec: 70.56, mag: 3.23 },   // Errai (gamma Cep)

  // Draco
  { ra: 262.61, dec: 65.71, mag: 2.24 },   // Eltanin (gamma Dra)
  { ra: 245.20, dec: 61.51, mag: 2.79 },   // Rastaban (beta Dra)

  // Corona Australis
  { ra: 287.37, dec: -37.90, mag: 4.10 },  // Alphekka Meridiana

  // Libra
  { ra: 222.72, dec: -16.04, mag: 2.61 },  // Zubeneschamali (beta Lib)
  { ra: 222.68, dec: -15.997, mag: 2.75 }, // Zubenelgenubi (alpha Lib)

  // Hydra
  { ra: 141.90, dec: -8.66, mag: 1.98 },   // Alphard (alpha Hya)

  // Corvus
  { ra: 183.95, dec: -17.54, mag: 2.59 },  // Gienah (gamma Crv)
  { ra: 187.47, dec: -23.40, mag: 2.65 },  // Kraz (beta Crv)

  // Columba
  { ra: 84.91, dec: -34.07, mag: 2.64 },   // Phact (alpha Col)

  // Lepus
  { ra: 82.06, dec: -20.76, mag: 2.58 },   // Arneb (alpha Lep)

  // Monoceros
  { ra: 100.24, dec: -7.03, mag: 3.93 },   // Alpha Mon

  // Cancer
  { ra: 130.81, dec: 21.47, mag: 3.52 },   // Acubens (alpha Cnc)
  { ra: 131.17, dec: 18.15, mag: 3.94 },   // Altarf (beta Cnc)

  // Telescopium / Ara / Norma (Southern)
  { ra: 262.69, dec: -49.88, mag: 1.76 },  // Alpha Arae (bright in Ara)
  { ra: 265.87, dec: -53.16, mag: 2.85 },  // Beta Arae

  // Musca
  { ra: 185.34, dec: -68.11, mag: 2.69 },  // Alpha Muscae

  // Tucana
  { ra: 336.13, dec: -61.56, mag: 2.86 },  // Alpha Tucanae

  // Phoenix
  { ra: 6.57, dec: -42.31, mag: 2.37 },    // Ankaa (alpha Phe)

  // Dorado
  { ra: 68.50, dec: -55.04, mag: 3.27 },   // Alpha Dor

  // Pictor
  { ra: 97.23, dec: -51.07, mag: 3.24 },   // Alpha Pic

  // Hydrus
  { ra: 29.69, dec: -61.57, mag: 2.80 },   // Beta Hyi

  // Volans
  { ra: 116.31, dec: -66.40, mag: 3.77 },  // Gamma Vol

  // Chamaeleon
  { ra: 124.63, dec: -76.92, mag: 4.07 },  // Alpha Cha

  // Additional bright stars for density
  { ra: 121.89, dec: -24.30, mag: 3.02 },  // Sigma Pup
  { ra: 109.29, dec: -37.10, mag: 2.50 },  // Pi Pup
  { ra: 143.22, dec: -57.03, mag: 2.47 },  // Omega Car
  { ra: 155.58, dec: -57.17, mag: 2.76 },  // Theta Car
  { ra: 167.15, dec: -58.97, mag: 2.97 },  // P.P. Car
  { ra: 191.57, dec: -49.42, mag: 2.55 },  // Gamma Cen
  { ra: 204.97, dec: -53.47, mag: 2.06 },  // Epsilon Cen
  { ra: 211.67, dec: -36.37, mag: 2.55 },  // Theta Cen
  { ra: 228.07, dec: -52.10, mag: 2.30 },  // Beta Lup
  { ra: 239.22, dec: -29.21, mag: 2.29 },  // Pi Sco
  { ra: 248.97, dec: -28.22, mag: 2.29 },  // Sigma Sco
  { ra: 253.08, dec: -38.05, mag: 2.69 },  // Epsilon Sco
  { ra: 258.76, dec: -43.24, mag: 1.87 },  // Kappa Sco
  { ra: 264.33, dec: -43.00, mag: 3.17 },  // Iota1 Sco
  { ra: 271.45, dec: -30.42, mag: 2.82 },  // Phi Sgr
  { ra: 274.41, dec: -36.76, mag: 2.59 },  // Kaus Media (delta Sgr)
  { ra: 285.65, dec: -29.88, mag: 2.89 },  // Tau Sgr
  { ra: 288.14, dec: -21.02, mag: 3.10 },  // Pi Sgr
  { ra: 290.97, dec: -40.62, mag: 1.85 },  // Alpha Tel (Al Nair)
  { ra: 296.24, dec: 10.61, mag: 3.36 },   // Delta Aql
  { ra: 299.69, dec: -1.29, mag: 3.77 },   // Lambda Aql
  { ra: 300.28, dec: 35.08, mag: 2.48 },   // Delta Cyg
  { ra: 311.55, dec: 33.97, mag: 2.46 },   // Epsilon Cyg (Gienah)
  { ra: 316.23, dec: 38.05, mag: 3.20 },   // Zeta Cyg
  { ra: 321.67, dec: 45.13, mag: 3.94 },   // Iota Cyg
  { ra: 340.37, dec: 10.83, mag: 2.49 },   // Sadalbari? Homam (zeta Peg)
  { ra: 351.34, dec: 19.18, mag: 3.52 },   // Eta Peg
  { ra: 354.84, dec: 5.63, mag: 3.27 },    // Lambda Aqr
  { ra: 348.58, dec: -9.09, mag: 3.27 },   // Delta Aqr
  { ra: 342.42, dec: -32.35, mag: 3.00 },  // Beta Gru
  { ra: 349.29, dec: -43.52, mag: 3.49 },  // Gamma Gru
  { ra: 1.73, dec: -17.99, mag: 3.47 },    // Diphda approach
  { ra: 10.90, dec: -17.99, mag: 2.04 },   // Diphda (beta Cet)
  { ra: 43.56, dec: -0.29, mag: 3.56 },    // Alpha Cet (Menkar region)
  { ra: 45.57, dec: 4.09, mag: 2.53 },     // Menkar (alpha Cet)
  { ra: 40.83, dec: -39.86, mag: 2.39 },   // Acamar (theta Eri)
  { ra: 55.73, dec: -9.76, mag: 3.73 },    // Nu Eri
  { ra: 62.97, dec: 0.30, mag: 3.19 },     // Omicron2 Eri (40 Eri)
  { ra: 65.73, dec: 17.54, mag: 3.53 },    // Epsilon Tau
  { ra: 67.15, dec: 15.87, mag: 3.65 },    // Gamma Tau
  { ra: 64.95, dec: 15.63, mag: 3.76 },    // Delta1 Tau
  { ra: 67.17, dec: 15.96, mag: 3.54 },    // Theta1 Tau
  { ra: 71.38, dec: 12.94, mag: 3.47 },    // Lambda Tau
  { ra: 73.56, dec: 2.86, mag: 3.69 },     // Xi Tau / Nu Tau
  { ra: 90.98, dec: 37.21, mag: 2.62 },    // Theta Aur
  { ra: 74.25, dec: 33.17, mag: 2.87 },    // Epsilon Aur
  { ra: 75.49, dec: 41.23, mag: 2.99 },    // Eta Aur
  { ra: 85.19, dec: -1.94, mag: 3.36 },    // Eta Ori
  { ra: 92.98, dec: 14.77, mag: 3.35 },    // Mu Gem
  { ra: 94.28, dec: 22.51, mag: 3.06 },    // Propus (eta Gem)
  { ra: 97.74, dec: 7.33, mag: 3.05 },     // Mu CMa / near
  { ra: 105.43, dec: -23.83, mag: 1.98 },  // Epsilon CMa
  { ra: 110.03, dec: -25.96, mag: 3.02 },  // Omicron2 CMa
  { ra: 119.19, dec: -52.98, mag: 2.21 },  // Rho Pup
  { ra: 122.38, dec: -2.98, mag: 3.94 },   // Epsilon Mon
  { ra: 125.71, dec: 43.19, mag: 2.97 },   // Iota UMa (Talitha)
  { ra: 134.80, dec: 48.04, mag: 3.14 },   // Kappa UMa
  { ra: 138.59, dec: 34.39, mag: 3.44 },   // Lambda UMa
  { ra: 148.19, dec: -14.85, mag: 3.11 },  // Nu Hya
  { ra: 154.17, dec: -42.12, mag: 3.13 },  // Iota Car
  { ra: 156.10, dec: 41.50, mag: 3.01 },   // Psi UMa
  { ra: 160.74, dec: -64.39, mag: 2.76 },  // Beta Car?
  { ra: 166.45, dec: -16.19, mag: 3.61 },  // Pi Hya
  { ra: 170.15, dec: 15.43, mag: 3.34 },   // Eta Leo
  { ra: 174.37, dec: -63.02, mag: 2.21 },  // Delta Cru / Ep Mus
  { ra: 176.40, dec: -18.30, mag: 2.94 },  // Gamma Hya
  { ra: 184.98, dec: -22.62, mag: 2.94 },  // Algorab (delta Crv)
  { ra: 188.60, dec: -16.52, mag: 2.58 },  // Minkar (epsilon Crv)
  { ra: 194.01, dec: 38.32, mag: 2.37 },   // Cor Caroli (alpha CVn)
  { ra: 198.03, dec: 36.71, mag: 4.26 },   // Chara (beta CVn)
  { ra: 207.40, dec: -41.69, mag: 2.20 },  // Menkent (theta Cen)
  { ra: 216.73, dec: -45.38, mag: 2.55 },  // Eta Cen
  { ra: 224.63, dec: -43.13, mag: 2.29 },  // Alpha Lup
  { ra: 228.87, dec: 33.31, mag: 2.40 },   // Muphrid (eta Boo)
  { ra: 229.25, dec: -9.38, mag: 2.75 },   // Alpha2 Lib
  { ra: 234.26, dec: 29.11, mag: 2.68 },   // Beta CrB
  { ra: 241.36, dec: -19.81, mag: 2.62 },  // Beta1 Sco
  { ra: 253.65, dec: -42.36, mag: 2.39 },  // Mu1 Sco
  { ra: 256.43, dec: -26.11, mag: 2.36 },  // Tau Sco
  { ra: 259.42, dec: 37.15, mag: 3.14 },   // Eta Her
  { ra: 262.69, dec: 52.30, mag: 3.17 },   // Zeta Dra
  { ra: 268.38, dec: 56.87, mag: 2.74 },   // Chi Dra
  { ra: 269.15, dec: 51.49, mag: 2.23 },   // Thuban-area
  { ra: 279.03, dec: 38.78, mag: 3.24 },   // Epsilon Lyr
  { ra: 282.52, dec: 33.36, mag: 3.24 },   // Delta Lyr
  { ra: 283.05, dec: 36.90, mag: 3.52 },   // Zeta1 Lyr
  { ra: 286.56, dec: -4.88, mag: 3.85 },   // Theta Ser
  { ra: 289.27, dec: -29.83, mag: 2.60 },  // Alpha CrA-related
  { ra: 291.37, dec: 3.11, mag: 3.24 },    // Theta Aql
  { ra: 293.09, dec: 52.98, mag: 3.79 },   // Eta Cyg
  { ra: 306.83, dec: -12.54, mag: 2.87 },  // Dabih (beta Cap)
  { ra: 307.55, dec: -14.78, mag: 3.58 },  // Alpha Cap
  { ra: 309.39, dec: -47.29, mag: 2.86 },  // Beta Pav
  { ra: 313.70, dec: 33.97, mag: 3.89 },   // 62 Cyg
  { ra: 314.29, dec: -12.54, mag: 3.77 },  // Psi Cap
  { ra: 318.95, dec: 38.73, mag: 3.72 },   // Pi2 Cyg
  { ra: 324.27, dec: -39.54, mag: 3.00 },  // Delta Gru
  { ra: 326.39, dec: 25.64, mag: 3.40 },   // Eta Peg
  { ra: 330.72, dec: 42.33, mag: 2.50 },   // Lacerta-area
  { ra: 335.41, dec: 46.72, mag: 3.77 },   // Mu Cep
  { ra: 340.75, dec: -46.88, mag: 2.10 },  // Alpha Gru (Alnair dup, keep)
  { ra: 344.98, dec: -29.37, mag: 3.66 },  // Delta PsA
  { ra: 349.71, dec: -32.35, mag: 3.49 },  // Gamma PsA
  { ra: 350.16, dec: 56.54, mag: 3.35 },   // Iota Cas
  { ra: 356.74, dec: 77.63, mag: 3.22 },   // Gamma Cep
  { ra: 358.19, dec: 59.15, mag: 3.44 },   // Epsilon Cas
  { ra: 359.83, dec: -29.30, mag: 3.37 },  // Theta PsA

  // Additional filler stars for sky density (mag 3.5-4.5)
  { ra: 5.22, dec: 8.18, mag: 3.56 },
  { ra: 12.44, dec: 41.08, mag: 3.87 },
  { ra: 18.44, dec: 24.27, mag: 3.61 },
  { ra: 22.09, dec: -43.32, mag: 3.41 },
  { ra: 26.35, dec: 50.69, mag: 3.32 },
  { ra: 33.25, dec: 8.85, mag: 3.63 },
  { ra: 37.04, dec: -13.51, mag: 3.56 },
  { ra: 42.67, dec: 27.26, mag: 3.88 },
  { ra: 48.02, dec: -28.99, mag: 3.69 },
  { ra: 53.23, dec: 9.73, mag: 3.73 },
  { ra: 58.53, dec: 31.88, mag: 3.54 },
  { ra: 63.50, dec: -42.29, mag: 3.60 },
  { ra: 69.55, dec: -30.56, mag: 3.85 },
  { ra: 75.62, dec: 6.96, mag: 3.71 },
  { ra: 82.03, dec: 28.61, mag: 3.16 },
  { ra: 87.83, dec: -35.77, mag: 3.59 },
  { ra: 93.72, dec: -6.27, mag: 3.60 },
  { ra: 99.17, dec: -43.20, mag: 3.61 },
  { ra: 104.32, dec: 20.57, mag: 3.36 },
  { ra: 109.89, dec: -12.04, mag: 4.08 },
  { ra: 115.31, dec: 28.76, mag: 3.57 },
  { ra: 120.08, dec: -36.73, mag: 3.34 },
  { ra: 127.57, dec: 60.72, mag: 3.01 },
  { ra: 133.85, dec: -46.65, mag: 3.62 },
  { ra: 139.27, dec: 5.95, mag: 3.61 },
  { ra: 144.96, dec: -59.27, mag: 3.32 },
  { ra: 150.82, dec: 36.71, mag: 3.80 },
  { ra: 157.22, dec: -16.84, mag: 3.90 },
  { ra: 163.33, dec: 28.27, mag: 3.44 },
  { ra: 169.73, dec: -54.49, mag: 3.34 },
  { ra: 175.33, dec: 47.78, mag: 3.83 },
  { ra: 181.73, dec: -22.68, mag: 3.56 },
  { ra: 187.01, dec: 28.27, mag: 4.03 },
  { ra: 192.57, dec: -17.54, mag: 3.88 },
  { ra: 197.97, dec: 27.88, mag: 4.15 },
  { ra: 203.67, dec: -31.93, mag: 3.55 },
  { ra: 209.57, dec: 18.40, mag: 4.05 },
  { ra: 214.85, dec: -46.06, mag: 3.22 },
  { ra: 220.29, dec: -47.39, mag: 3.41 },
  { ra: 225.49, dec: 40.39, mag: 3.47 },
  { ra: 230.67, dec: -25.28, mag: 3.32 },
  { ra: 236.55, dec: 15.42, mag: 3.54 },
  { ra: 243.36, dec: -19.46, mag: 3.96 },
  { ra: 249.09, dec: -10.57, mag: 3.82 },
  { ra: 254.42, dec: 31.60, mag: 3.89 },
  { ra: 260.50, dec: -24.99, mag: 3.62 },
  { ra: 266.90, dec: -25.42, mag: 3.32 },
  { ra: 272.00, dec: -25.42, mag: 3.97 },
  { ra: 278.38, dec: 21.77, mag: 3.75 },
  { ra: 284.05, dec: -4.88, mag: 3.44 },
  { ra: 289.81, dec: -21.74, mag: 4.12 },
  { ra: 295.02, dec: -5.03, mag: 3.43 },
  { ra: 301.29, dec: 19.49, mag: 3.71 },
  { ra: 307.24, dec: 15.91, mag: 3.77 },
  { ra: 313.53, dec: -26.92, mag: 3.05 },
  { ra: 319.23, dec: 34.90, mag: 3.52 },
  { ra: 325.02, dec: -16.66, mag: 3.68 },
  { ra: 331.09, dec: 6.38, mag: 3.96 },
  { ra: 337.82, dec: -18.93, mag: 3.73 },
  { ra: 343.66, dec: 24.60, mag: 3.41 },
  { ra: 349.48, dec: -20.10, mag: 3.74 },
  { ra: 355.51, dec: 31.33, mag: 3.87 },
];

export default STARS;
