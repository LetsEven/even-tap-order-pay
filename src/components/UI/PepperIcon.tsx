/**
 * Icono de Pepper: marco redondo (gris stone-500, trazo delgado) abierto arriba
 * a la derecha, con "AI" al centro en el mismo gris y dos estrellas (sparks) en
 * grass saliendo por la abertura. Sobre el fondo blanco del contenedor.
 *
 * El contenedor define el círculo blanco y el tamaño; `className` controla el
 * tamaño del icono (por defecto llena el contenedor con `size-full`).
 */
export default function PepperIcon({
  className = "size-full",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
      className={`text-stone-500 ${className}`}
    >
      {/* marco redondo, abierto arriba a la derecha */}
      <path
        d="M39.99 23.44 A16 16 0 1 1 29.99 9.16"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      {/* AI al centro */}
      <text
        x="24"
        y="24"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="15"
        fontWeight={400}
        fill="currentColor"
      >
        AI
      </text>
      {/* estrella grande, saliendo por la abertura */}
      <path
        className="fill-even-grass"
        d="M38 6 L39.44 10.56 L44 12 L39.44 13.44 L38 18 L36.56 13.44 L32 12 L36.56 10.56 Z"
      />
      {/* estrella chica */}
      <path
        className="fill-even-grass"
        d="M43 15.4 L43.87 18.13 L46.6 19 L43.87 19.87 L43 22.6 L42.13 19.87 L39.4 19 L42.13 18.13 Z"
      />
    </svg>
  );
}
