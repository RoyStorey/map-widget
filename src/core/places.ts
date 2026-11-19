/**
 * Built-in gazetteer of historically important places so lessons can say
 * `"at": "Hastings"` instead of raw coordinates. Coordinates are [lon, lat]
 * and approximate (city centre / battlefield). Names are matched
 * case-insensitively, ignoring accents; aliases are separated by "|".
 */
import type { LonLat } from './geo';

const RAW: [string, number, number][] = [
  // ---------------------------------------------------------------- Europe: capitals & major cities
  ['London|Londinium', -0.128, 51.507], ['Paris|Lutetia', 2.352, 48.857], ['Rome|Roma', 12.496, 41.903], ['Berlin', 13.405, 52.52],
  ['Madrid', -3.704, 40.417], ['Lisbon|Lisboa|Olisipo', -9.139, 38.722], ['Vienna|Wien|Vindobona', 16.373, 48.208], ['Prague|Praha', 14.438, 50.075],
  ['Warsaw|Warszawa', 21.012, 52.23], ['Moscow|Moskva', 37.618, 55.756], ['Saint Petersburg|St Petersburg|Leningrad|Petrograd', 30.316, 59.939],
  ['Kyiv|Kiev', 30.523, 50.45], ['Minsk', 27.567, 53.9], ['Vilnius|Wilno', 25.28, 54.687], ['Riga', 24.105, 56.95], ['Tallinn|Reval', 24.754, 59.437],
  ['Helsinki', 24.938, 60.17], ['Stockholm', 18.069, 59.329], ['Oslo|Christiania', 10.752, 59.914], ['Copenhagen|København', 12.568, 55.676],
  ['Amsterdam', 4.904, 52.368], ['Brussels|Bruxelles', 4.352, 50.85], ['Luxembourg', 6.13, 49.611], ['Bern', 7.447, 46.948], ['Zurich|Zürich', 8.541, 47.377],
  ['Geneva|Genève', 6.143, 46.204], ['Budapest|Buda|Pest', 19.04, 47.498], ['Bucharest|București', 26.103, 44.427], ['Sofia|Serdica', 23.322, 42.698],
  ['Belgrade|Beograd|Singidunum', 20.457, 44.787], ['Zagreb', 15.982, 45.815], ['Sarajevo', 18.413, 43.856], ['Athens|Athinai', 23.728, 37.984],
  ['Sparta', 22.43, 37.075], ['Thebes (Greece)|Thebes|Thiva', 23.319, 38.322], ['Corinth', 22.93, 37.906], ['Delphi', 22.501, 38.482], ['Olympia', 21.63, 37.638],
  ['Pella', 22.524, 40.759], ['Thessaloniki|Salonica|Thessalonica', 22.944, 40.64], ['Istanbul|Constantinople|Byzantium', 28.978, 41.008],
  ['Edirne|Adrianople', 26.555, 41.677], ['Dublin', -6.26, 53.35], ['Edinburgh', -3.189, 55.953], ['York|Eboracum', -1.082, 53.96],
  ['Canterbury', 1.08, 51.28], ['Dover', 1.31, 51.13], ['Portsmouth', -1.09, 50.8], ['Plymouth', -4.143, 50.375], ['Liverpool', -2.983, 53.408],
  ['Manchester', -2.244, 53.483], ['Bristol', -2.588, 51.454], ['Oxford', -1.258, 51.752], ['Cambridge', 0.122, 52.205],
  ['Hamburg', 9.993, 53.551], ['Munich|München', 11.582, 48.135], ['Cologne|Köln|Colonia', 6.96, 50.938], ['Frankfurt', 8.682, 50.11],
  ['Dresden', 13.737, 51.05], ['Leipzig', 12.373, 51.34], ['Nuremberg|Nürnberg', 11.077, 49.452], ['Aachen|Aix-la-Chapelle', 6.084, 50.776],
  ['Bremen', 8.807, 53.079], ['Danzig|Gdańsk|Gdansk', 18.646, 54.352], ['Kraków|Krakow|Cracow', 19.945, 50.065], ['Königsberg|Kaliningrad', 20.452, 54.71],
  ['Lyon|Lugdunum', 4.835, 45.764], ['Marseille|Massilia', 5.37, 43.296], ['Bordeaux', -0.579, 44.838], ['Toulouse', 1.444, 43.605],
  ['Orléans|Orleans', 1.909, 47.902], ['Reims|Rheims', 4.032, 49.258], ['Rouen', 1.099, 49.443], ['Calais', 1.858, 50.951], ['Dunkirk|Dunkerque', 2.377, 51.034],
  ['Verdun', 5.384, 49.16], ['Strasbourg', 7.752, 48.573], ['Nice', 7.262, 43.71], ['Avignon', 4.806, 43.95], ['Versailles', 2.12, 48.805],
  ['Barcelona', 2.173, 41.385], ['Seville|Sevilla|Hispalis', -5.984, 37.389], ['Córdoba|Cordoba', -4.779, 37.888], ['Granada', -3.598, 37.177],
  ['Toledo', -4.027, 39.863], ['Valencia', -0.376, 39.47], ['Cádiz|Cadiz|Gades', -6.288, 36.527], ['Cartagena (Spain)|Carthago Nova', -0.986, 37.606],
  ['Gibraltar', -5.354, 36.14], ['Porto|Oporto', -8.611, 41.15], ['Milan|Milano|Mediolanum', 9.19, 45.464], ['Venice|Venezia', 12.316, 45.441],
  ['Florence|Firenze', 11.256, 43.77], ['Naples|Napoli|Neapolis', 14.268, 40.852], ['Genoa|Genova', 8.946, 44.405], ['Turin|Torino', 7.686, 45.07],
  ['Ravenna', 12.199, 44.418], ['Pisa', 10.402, 43.723], ['Syracuse|Siracusa', 15.287, 37.075], ['Palermo', 13.361, 38.116], ['Pompeii', 14.485, 40.75],
  ['Valletta|Malta', 14.514, 35.9], ['Ajaccio|Corsica', 8.738, 41.919], ['Vatican City|Vatican', 12.453, 41.902], ['Tirana', 19.819, 41.328],
  ['Odessa|Odesa', 30.732, 46.482], ['Sevastopol', 33.522, 44.616], ['Stalingrad|Volgograd|Tsaritsyn', 44.516, 48.708], ['Kursk', 36.193, 51.73],
  ['Smolensk', 32.045, 54.782], ['Novgorod|Veliky Novgorod', 31.275, 58.522], ['Vladimir', 40.397, 56.129], ['Kazan', 49.106, 55.796],
  ['Sarai', 47.5, 47.0], ['Arkhangelsk|Archangel', 40.516, 64.539], ['Murmansk', 33.083, 68.97],
  // ---------------------------------------------------------------- Europe: battlefields
  ['Hastings', 0.487, 50.912], ['Agincourt|Azincourt', 2.13, 50.463], ['Crécy|Crecy', 1.882, 50.257], ['Poitiers', 0.34, 46.58], ['Tours', 0.69, 47.394],
  ['Waterloo', 4.412, 50.68], ['Austerlitz|Slavkov', 16.762, 49.128], ['Borodino', 35.82, 55.52], ['Leipzig battlefield|Battle of the Nations', 12.413, 51.312],
  ['Trafalgar|Cape Trafalgar', -6.034, 36.183], ['Jena', 11.586, 50.927], ['Marengo', 8.68, 44.89], ['Wagram', 16.564, 48.3], ['Ulm', 9.993, 48.401],
  ['Cannae', 16.132, 41.306], ['Zama', 9.2, 36.0], ['Lake Trasimene|Trasimene', 12.1, 43.17], ['Alesia', 4.5, 47.54], ['Actium', 20.75, 38.95],
  ['Pharsalus', 22.38, 39.3], ['Teutoburg Forest|Kalkriese', 8.13, 52.41], ['Marathon', 23.97, 38.15], ['Thermopylae', 22.536, 38.796],
  ['Salamis', 23.47, 37.96], ['Plataea', 23.27, 38.21], ['Chaeronea', 22.84, 38.5], ['Granicus', 27.4, 40.2], ['Issus', 36.2, 36.84],
  ['Gaugamela', 43.43, 36.36], ['Hydaspes', 73.6, 32.9], ['Adrianople battlefield', 26.6, 41.75], ['Catalaunian Plains|Chalons', 4.36, 48.96],
  ['Lechfeld', 10.88, 48.25], ['Bannockburn', -3.92, 56.09], ['Stirling', -3.937, 56.117], ['Bosworth', -1.41, 52.59], ['Culloden', -4.075, 57.478],
  ['Kosovo Polje|Kosovo', 21.1, 42.67], ['Mohács|Mohacs', 18.68, 45.94], ['Lepanto|Nafpaktos', 21.1, 38.25], ['Grunwald|Tannenberg (1410)', 20.1, 53.48],
  ['Tannenberg', 20.25, 53.5], ['Lützen|Lutzen', 12.14, 51.26], ['Breitenfeld', 12.38, 51.4], ['White Mountain', 14.32, 50.08], ['Blenheim|Blindheim', 10.64, 48.63],
  ['Poltava', 34.55, 49.59], ['Rossbach', 11.93, 51.24], ['Leuthen', 16.78, 51.13], ['Valmy', 4.77, 49.08], ['Sedan', 4.94, 49.7], ['Gravelotte', 6.03, 49.11],
  ['Marne', 3.5, 48.95], ['Ypres|Ieper', 2.885, 50.851], ['Somme', 2.69, 49.98], ['Passchendaele', 3.02, 50.9], ['Gallipoli', 26.4, 40.25], ['Caporetto|Kobarid', 13.58, 46.25],
  ['Jutland', 6.0, 56.7], ['Normandy|Omaha Beach', -0.87, 49.37], ['Utah Beach', -1.175, 49.415], ['Gold Beach', -0.56, 49.343], ['Juno Beach', -0.43, 49.337], ['Sword Beach', -0.3, 49.296],
  ['Pointe du Hoc', -0.989, 49.396], ['Bastogne', 5.72, 50.0], ['Arnhem', 5.9, 51.98], ['Monte Cassino|Cassino', 13.81, 41.49], ['Anzio', 12.63, 41.45],
  ['Remagen', 7.23, 50.58], ['Dieppe', 1.08, 49.92], ['El Alamein', 28.95, 30.83], ['Tobruk', 23.96, 32.08], ['Auschwitz', 19.2, 50.03], ['Torgau', 13.0, 51.56],
  ['Kunersdorf', 14.65, 52.36], ['Navarino|Pylos', 21.67, 36.91], ['Balaklava', 33.6, 44.5],
  // ---------------------------------------------------------------- Middle East & North Africa
  ['Jerusalem', 35.235, 31.778], ['Damascus', 36.292, 33.513], ['Baghdad', 44.366, 33.315], ['Babylon', 44.42, 32.54], ['Nineveh|Mosul', 43.15, 36.36],
  ['Ur', 46.103, 30.963], ['Uruk', 45.636, 31.324], ['Persepolis', 52.89, 29.935], ['Susa', 48.25, 32.19], ['Ctesiphon', 44.58, 33.09], ['Tehran', 51.389, 35.689],
  ['Isfahan', 51.668, 32.652], ['Tabriz', 46.29, 38.08], ['Mecca|Makkah', 39.826, 21.423], ['Medina', 39.611, 24.468], ['Antioch|Antakya', 36.161, 36.202],
  ['Aleppo', 37.161, 36.202], ['Tyre', 35.196, 33.271], ['Sidon', 35.371, 33.563], ['Beirut', 35.502, 33.894], ['Acre|Akko', 35.07, 32.927], ['Jaffa|Tel Aviv', 34.75, 32.05],
  ['Petra', 35.444, 30.329], ['Palmyra', 38.268, 34.552], ['Troy|Hisarlik', 26.239, 39.957], ['Ephesus', 27.341, 37.94], ['Ankara|Ancyra', 32.854, 39.92],
  ['Bursa', 29.06, 40.183], ['Konya|Iconium', 32.485, 37.871], ['Manzikert|Malazgirt', 42.53, 39.14], ['Hattin', 35.45, 32.8], ['Ain Jalut', 35.38, 32.55],
  ['Yarmouk', 35.95, 32.8], ['Qadisiyyah', 44.3, 31.9], ['Karbala', 44.03, 32.616], ['Cairo', 31.236, 30.044], ['Alexandria', 29.919, 31.2], ['Giza', 31.131, 29.979],
  ['Memphis (Egypt)', 31.255, 29.845], ['Thebes (Egypt)|Luxor', 32.639, 25.687], ['Aswan', 32.9, 24.088], ['Abu Simbel', 31.626, 22.337], ['Kadesh', 36.52, 34.56],
  ['Megiddo', 35.18, 32.585], ['Port Said|Suez Canal', 32.3, 31.26], ['Suez', 32.55, 29.97], ['Carthage', 10.323, 36.853], ['Tunis', 10.18, 36.806],
  ['Tripoli', 13.191, 32.888], ['Benghazi', 20.068, 32.119], ['Algiers', 3.059, 36.754], ['Oran', -0.633, 35.697], ['Tangier', -5.834, 35.759],
  ['Fez', -5.0, 34.033], ['Marrakesh', -7.981, 31.63], ['Casablanca', -7.59, 33.573], ['Timbuktu', -3.008, 16.773], ['Khartoum', 32.56, 15.5], ['Aden', 45.03, 12.8],
  ['Muscat', 58.59, 23.61], ['Hormuz|Strait of Hormuz', 56.4, 26.6], ['Bab-el-Mandeb', 43.4, 12.6], ['Kuwait City', 47.978, 29.375], ['Riyadh', 46.716, 24.713], ['Dubai', 55.296, 25.276],
  // ---------------------------------------------------------------- ancient Mediterranean & biblical sites
  ['Tarsus', 34.895, 36.918], ['Paphos|Nea Paphos', 32.41, 34.757], ['Salamis (Cyprus)', 33.9, 35.18], ['Cyprus', 33.2, 35.05], ['Perga', 30.854, 36.961],
  ['Pisidian Antioch|Antioch in Pisidia', 31.19, 38.306], ['Lystra', 32.33, 37.58], ['Derbe', 33.36, 37.35], ['Attalia|Antalya', 30.71, 36.885],
  ['Seleucia Pieria|Seleucia', 35.93, 36.12], ['Troas|Alexandria Troas', 26.15, 39.75], ['Philippi', 24.286, 41.013], ['Neapolis (Macedonia)|Kavala', 24.41, 40.94],
  ['Berea|Beroea|Veria', 22.2, 40.52], ['Caesarea Maritima|Caesarea', 34.89, 32.5], ['Rhodes', 28.227, 36.434], ['Miletus', 27.278, 37.53],
  ['Myra', 29.985, 36.26], ['Cenchreae', 22.99, 37.88], ['Crete', 24.9, 35.2], ['Fair Havens|Kaloi Limenes', 24.81, 34.93],
  ['Rhegium|Reggio Calabria', 15.65, 38.11], ['Puteoli|Pozzuoli', 14.12, 40.82], ['Nazareth', 35.3, 32.7], ['Bethlehem', 35.2, 31.705],
  ['Capernaum', 35.575, 32.88], ['Sea of Galilee', 35.59, 32.82],
  // ---------------------------------------------------------------- Normandy 1944
  ['Southampton', -1.404, 50.909], ['Weymouth', -2.457, 50.614], ['Isle of Wight', -1.3, 50.68], ['Caen', -0.37, 49.183], ['Cherbourg', -1.62, 49.64],
  ['Pegasus Bridge|Bénouville', -0.274, 49.242], ['Sainte-Mère-Église|Sainte-Mere-Eglise', -1.317, 49.408], ['Carentan', -1.247, 49.303],
  ['Arromanches|Mulberry B', -0.622, 49.34], ['Falaise', -0.197, 48.895], ['Saint-Lô|Saint-Lo', -1.09, 49.116], ['Avranches', -1.356, 48.684], ['Le Havre', 0.107, 49.494],
  // ---------------------------------------------------------------- Sub-Saharan Africa
  ['Cape Town|Cape of Good Hope', 18.42, -33.92], ['Durban', 31.03, -29.86], ['Isandlwana', 30.65, -28.36], ['Johannesburg', 28.047, -26.204], ['Great Zimbabwe', 30.93, -20.27],
  ['Kilwa', 39.52, -8.96], ['Zanzibar', 39.19, -6.165], ['Mombasa', 39.668, -4.043], ['Addis Ababa', 38.757, 9.03], ['Aksum|Axum', 38.72, 14.13], ['Adwa', 38.9, 14.17],
  ['Lagos', 3.379, 6.524], ['Accra', -0.187, 5.603], ['Elmina', -1.35, 5.08], ['Dakar|Gorée', -17.444, 14.693], ['Luanda', 13.234, -8.838], ['Kinshasa', 15.266, -4.441],
  ['Nairobi', 36.822, -1.292], ['Benin City', 5.62, 6.34], ['Kano', 8.52, 12.0], ['Mogadishu', 45.318, 2.046],
  // ---------------------------------------------------------------- Asia
  ['Beijing|Peking|Dadu|Khanbaliq|Zhongdu', 116.407, 39.904], ['Nanjing|Nanking', 118.797, 32.06], ["Xi'an|Xian|Chang'an|Changan", 108.94, 34.341],
  ['Luoyang', 112.454, 34.62], ['Kaifeng', 114.31, 34.8], ['Hangzhou|Lin\'an', 120.155, 30.274], ['Shanghai', 121.474, 31.23], ['Guangzhou|Canton', 113.264, 23.129],
  ['Hong Kong', 114.17, 22.32], ['Macau', 113.543, 22.199], ['Chongqing|Chungking', 106.551, 29.563], ['Wuhan', 114.305, 30.593], ['Chengdu', 104.066, 30.572],
  ['Xiangyang', 112.14, 32.04], ['Karakorum', 102.84, 47.2], ['Ulaanbaatar|Urga', 106.906, 47.886], ['Lhasa', 91.14, 29.65], ['Kashgar', 75.99, 39.47],
  ['Dunhuang', 94.66, 40.14], ['Samarkand', 66.976, 39.654], ['Bukhara', 64.42, 39.77], ['Merv', 61.83, 37.66], ['Otrar', 68.3, 42.85], ['Tashkent', 69.24, 41.3],
  ['Kabul', 69.207, 34.555], ['Herat', 62.2, 34.35], ['Kandahar', 65.71, 31.61], ['Balkh|Bactra', 66.9, 36.76], ['Delhi|New Delhi', 77.209, 28.614], ['Agra', 78.008, 27.176],
  ['Panipat', 76.97, 29.39], ['Plassey|Palashi', 88.25, 23.8], ['Kolkata|Calcutta', 88.364, 22.573], ['Mumbai|Bombay', 72.878, 19.076], ['Chennai|Madras', 80.271, 13.083],
  ['Goa', 73.83, 15.49], ['Calicut|Kozhikode', 75.78, 11.25], ['Pataliputra|Patna', 85.137, 25.594], ['Lahore', 74.358, 31.52], ['Karachi', 67.01, 24.86], ['Taxila', 72.83, 33.75],
  ['Colombo', 79.861, 6.927], ['Dhaka|Dacca', 90.413, 23.81], ['Kathmandu', 85.324, 27.717], ['Yangon|Rangoon', 96.16, 16.84], ['Mandalay', 96.08, 21.97],
  ['Bangkok', 100.502, 13.756], ['Ayutthaya', 100.56, 14.35], ['Angkor|Siem Reap', 103.867, 13.412], ['Hanoi', 105.834, 21.028], ['Saigon|Ho Chi Minh City', 106.66, 10.762],
  ['Dien Bien Phu', 103.02, 21.39], ['Hue', 107.59, 16.46], ['Singapore', 103.82, 1.352], ['Malacca|Melaka|Strait of Malacca', 102.25, 2.19], ['Kuala Lumpur', 101.687, 3.139],
  ['Jakarta|Batavia', 106.845, -6.208], ['Manila', 120.984, 14.6], ['Cebu|Mactan', 123.9, 10.31], ['Tokyo|Edo', 139.692, 35.69], ['Kyoto', 135.768, 35.012],
  ['Osaka', 135.502, 34.694], ['Nara', 135.805, 34.685], ['Hiroshima', 132.455, 34.385], ['Nagasaki', 129.873, 32.75], ['Sekigahara', 136.47, 35.37], ['Hakata|Fukuoka', 130.4, 33.59],
  ['Kamakura', 139.55, 35.32], ['Okinawa|Naha', 127.68, 26.21], ['Iwo Jima', 141.32, 24.78], ['Seoul|Hanseong', 126.978, 37.567], ['Pyongyang', 125.762, 39.039],
  ['Busan|Pusan', 129.075, 35.18], ['Incheon|Inchon', 126.705, 37.456], ['Gyeongju', 129.22, 35.86], ['Taipei', 121.565, 25.033], ['Vladivostok', 131.886, 43.115],
  ['Harbin', 126.53, 45.8], ['Mukden|Shenyang', 123.43, 41.8], ['Port Arthur|Lüshun', 121.26, 38.81], ['Tsushima', 129.3, 34.4], ['Midway|Midway Atoll', -177.37, 28.21],
  ['Pearl Harbor|Honolulu', -157.95, 21.36], ['Guadalcanal', 160.0, -9.45], ['Leyte', 125.0, 11.0], ['Coral Sea', 155.0, -15.0], ['Saipan', 145.75, 15.18], ['Guam', 144.79, 13.44],
  ['Tarawa', 172.98, 1.42], ['Rabaul', 152.17, -4.2], ['Port Moresby', 147.18, -9.44],
  // ---------------------------------------------------------------- Americas
  ['Washington|Washington D.C.', -77.037, 38.907], ['New York|New Amsterdam', -74.006, 40.713], ['Boston', -71.059, 42.36], ['Philadelphia', -75.165, 39.953],
  ['Baltimore', -76.612, 39.29], ['Charleston', -79.931, 32.776], ['Savannah', -81.1, 32.08], ['Richmond', -77.436, 37.541], ['Jamestown', -76.78, 37.21],
  ['Plymouth (Massachusetts)|Plymouth Rock', -70.662, 41.958], ['Yorktown', -76.51, 37.24], ['Saratoga', -73.64, 43.01], ['Lexington', -71.227, 42.443], ['Concord', -71.35, 42.46],
  ['Bunker Hill', -71.061, 42.376], ['Valley Forge', -75.443, 40.097], ['Trenton', -74.743, 40.217], ['Gettysburg', -77.231, 39.83], ['Antietam|Sharpsburg', -77.74, 39.47],
  ['Vicksburg', -90.878, 32.353], ['Fort Sumter', -79.874, 32.752], ['Appomattox', -78.8, 37.38], ['Atlanta', -84.388, 33.749], ['Bull Run|Manassas', -77.52, 38.81],
  ['Chancellorsville', -77.64, 38.31], ['Shiloh', -88.33, 35.15], ['New Orleans', -90.072, 29.951], ['Chicago', -87.63, 41.878], ['St. Louis|Saint Louis', -90.199, 38.627],
  ['Detroit', -83.046, 42.331], ['Pittsburgh|Fort Duquesne', -79.996, 40.441], ['Alamo|San Antonio', -98.486, 29.426], ['San Jacinto', -95.08, 29.75], ['Houston', -95.369, 29.76],
  ['Little Bighorn', -107.43, 45.57], ['Los Angeles', -118.244, 34.052], ['San Francisco', -122.419, 37.775], ['Seattle', -122.332, 47.606], ['Sutter\'s Mill|Coloma', -120.89, 38.8],
  ['Los Alamos', -106.3, 35.88], ['Trinity Site', -106.47, 33.68], ['Cape Canaveral', -80.6, 28.39], ['Quebec|Québec', -71.208, 46.813], ['Montreal|Montréal', -73.567, 45.502],
  ['Toronto|York (Upper Canada)', -79.383, 43.653], ['Ottawa', -75.697, 45.421], ['Halifax', -63.575, 44.649], ['Louisbourg', -59.99, 45.89], ['Vancouver', -123.12, 49.283],
  ['Mexico City|Tenochtitlan', -99.133, 19.433], ['Veracruz', -96.134, 19.173], ['Chichen Itza', -88.569, 20.684], ['Tikal', -89.623, 17.222], ['Teotihuacan', -98.844, 19.692],
  ['Puebla', -98.206, 19.041], ['Havana|La Habana', -82.366, 23.113], ['Santo Domingo|Hispaniola', -69.931, 18.486], ['San Salvador (Bahamas)|Guanahani', -74.48, 24.05],
  ['Port Royal|Kingston', -76.79, 17.97], ['Panama City', -79.519, 8.983], ['Panama Canal', -79.68, 9.08], ['Cartagena (Colombia)', -75.48, 10.39], ['Bogotá|Bogota', -74.072, 4.711],
  ['Caracas', -66.904, 10.481], ['Quito', -78.468, -0.18], ['Lima', -77.043, -12.046], ['Cusco|Cuzco', -71.968, -13.532], ['Machu Picchu', -72.545, -13.163], ['Cajamarca', -78.51, -7.16],
  ['Potosí|Potosi', -65.75, -19.58], ['La Paz', -68.15, -16.5], ['Santiago', -70.669, -33.449], ['Valparaíso|Valparaiso', -71.627, -33.047], ['Buenos Aires', -58.382, -34.604],
  ['Montevideo', -56.164, -34.901], ['Asunción|Asuncion', -57.575, -25.264], ['Rio de Janeiro', -43.173, -22.907], ['Salvador (Brazil)|Bahia', -38.501, -12.971], ['São Paulo|Sao Paulo', -46.633, -23.551],
  ['Recife', -34.877, -8.048], ['Cape Horn', -67.27, -55.98], ['Strait of Magellan|Magellan Strait', -70.9, -53.5], ['Falkland Islands|Stanley', -57.85, -51.7], ['Galápagos|Galapagos', -90.5, -0.6],
  // ---------------------------------------------------------------- Oceania & polar
  ['Sydney|Botany Bay', 151.209, -33.868], ['Melbourne', 144.963, -37.814], ['Canberra', 149.13, -35.281], ['Perth', 115.86, -31.95], ['Darwin', 130.84, -12.46],
  ['Auckland', 174.763, -36.848], ['Wellington', 174.776, -41.286], ['Waitangi', 174.07, -35.27], ['Tahiti|Papeete', -149.57, -17.54], ['Fiji|Suva', 178.44, -18.14],
  ['Easter Island|Rapa Nui', -109.35, -27.11], ['Hawaii|Kealakekua Bay', -155.93, 19.48], ['South Pole', 0, -85], ['North Pole', 0, 85],
  // ---------------------------------------------------------------- landmarks
  ['Hagia Sophia|Ayasofya', 28.98, 41.0086], ['Topkapi Palace', 28.9834, 41.0115], ['Colosseum', 12.4924, 41.8902], ['Roman Forum', 12.4853, 41.8925],
  ['Acropolis|Parthenon', 23.7257, 37.9715], ['Great Pyramid|Pyramids of Giza', 31.1342, 29.9792], ['Great Wall (Badaling)|Great Wall', 116.016, 40.359],
  ['Forbidden City', 116.397, 39.917], ['Kremlin|Red Square', 37.6176, 55.752], ['Westminster Abbey|Westminster', -0.1273, 51.4994], ['Tower of London', -0.0759, 51.5081],
  ['Notre-Dame de Paris|Notre-Dame', 2.3499, 48.853], ['Bastille', 2.3691, 48.8532], ['Alhambra', -3.5881, 37.1761], ['Taj Mahal', 78.0421, 27.1751],
  ['Angkor Wat', 103.867, 13.4125], ['Stonehenge', -1.8262, 51.1789], ['Hadrian\'s Wall', -2.38, 55.0], ['Brandenburg Gate', 13.3777, 52.5163],
  ['Reichstag', 13.3761, 52.5186], ['Independence Hall', -75.15, 39.9489], ['White House', -77.0365, 38.8977], ['Statue of Liberty|Ellis Island', -74.0445, 40.6892],
  ['Temple Mount|Dome of the Rock', 35.2353, 31.7781], ['Kaaba|Masjid al-Haram', 39.8262, 21.4225], ['Persepolis palace', 52.8916, 29.9345], ['Pantheon', 12.4769, 41.8986],
  ['Mont-Saint-Michel', -1.5115, 48.6361], ['Bayeux', -0.7025, 49.2765], ['Senlac Hill|Battle Abbey', 0.4877, 50.9136], ['Stamford Bridge', -0.914, 53.99],
  ['Pevensey', 0.334, 50.819], ['Berlin Wall|Checkpoint Charlie', 13.3904, 52.5075], ['Pearl Harbor (USS Arizona)', -157.95, 21.365],
  // ---------------------------------------------------------------- seas, straits & waypoints (useful for routes)
  ['English Channel', -1.5, 50.2], ['Strait of Dover', 1.45, 51.0], ['Strait of Gibraltar', -5.6, 35.96], ['Bosporus|Bosphorus', 29.05, 41.12], ['Dardanelles|Hellespont', 26.4, 40.2],
  ['Suez Canal (south)', 32.56, 29.93], ['Cape Verde|Cabo Verde', -23.51, 14.93], ['Canary Islands', -15.43, 28.12], ['Madeira', -16.92, 32.65], ['Azores', -25.67, 37.74],
  ['Sierra Leone|Freetown', -13.234, 8.465], ['Mozambique Island', 40.73, -15.03], ['Malindi', 40.12, -3.22], ['Sri Lanka|Ceylon', 80.77, 7.87], ['Sunda Strait', 105.8, -6.0],
  ['Moluccas|Spice Islands|Ternate', 127.38, 0.79], ['Philippine Sea', 135.0, 15.0], ['Bering Strait', -168.9, 65.8], ['Hudson Bay', -85.0, 60.0], ['Newfoundland|St. John\'s', -52.71, 47.56],
  ['Caribbean Sea', -75.0, 15.0], ['Gulf of Mexico', -90.0, 25.0], ['Mediterranean Sea', 18.0, 35.0], ['Black Sea', 34.0, 43.3], ['Caspian Sea', 50.5, 41.5], ['Red Sea', 38.5, 20.0],
  ['Persian Gulf', 51.0, 27.0], ['Arabian Sea', 64.0, 15.0], ['Bay of Bengal', 88.0, 15.0], ['South China Sea', 114.0, 12.0], ['Sea of Japan', 135.0, 40.0], ['North Sea', 3.0, 56.0],
  ['Baltic Sea', 19.0, 57.0], ['Atlantic Ocean', -35.0, 30.0], ['Pacific Ocean', -150.0, 0.0], ['Indian Ocean', 75.0, -15.0], ['Southern Ocean', 60.0, -60.0], ['Arctic Ocean', 0.0, 85.0],
];

function norm(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’'`.]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

let index: Map<string, { name: string; at: LonLat }> | null = null;
function getIndex() {
  if (index) return index;
  index = new Map();
  for (const [names, lon, lat] of RAW) {
    const parts = names.split('|');
    for (const n of parts) {
      const k = norm(n);
      if (!index.has(k)) index.set(k, { name: parts[0], at: [lon, lat] });
    }
  }
  return index;
}

/** Look up a place by name (case/accent-insensitive). Returns null if unknown. */
export function findPlace(name: string): LonLat | null {
  const hit = getIndex().get(norm(name));
  return hit ? [hit.at[0], hit.at[1]] : null;
}

/** Closest known names to an unknown one (for helpful validation messages). */
export function suggestPlaces(name: string, max = 3): string[] {
  const q = norm(name);
  const scored: [number, string][] = [];
  for (const [k, v] of getIndex()) {
    let score = 0;
    if (k.includes(q) || q.includes(k)) score = 100 - Math.abs(k.length - q.length);
    else {
      const qa = new Set(q.split(' '));
      for (const w of k.split(' ')) if (qa.has(w)) score += 10;
      // shared prefix
      let p = 0;
      while (p < k.length && p < q.length && k[p] === q[p]) p++;
      score += p * 2;
    }
    if (score > 6) scored.push([score, v.name]);
  }
  return [...new Set(scored.sort((a, b) => b[0] - a[0]).map((x) => x[1]))].slice(0, max);
}

/** All canonical place names (for docs / autocompletion). */
export function placeNames(): string[] {
  return RAW.map((r) => r[0].split('|')[0]);
}

export function placeCount(): number {
  return RAW.length;
}
