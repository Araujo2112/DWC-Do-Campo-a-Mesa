export default function MapaProdutor({ lat, lng, nome }) {
  const d = 0.04;
  const bbox = [lng - d, lat - d / 1.5, lng + d, lat + d / 1.5].join(',');
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`;

  return (
    <figure className="mapa-produtor mb-0">
      <iframe title={`Localização de ${nome} no mapa`} src={src} loading="lazy" />
      <figcaption className="small mt-1">
        <a href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=14/${lat}/${lng}`}
          target="_blank" rel="noopener noreferrer">
          Abrir mapa maior
        </a>
      </figcaption>
    </figure>
  );
}
