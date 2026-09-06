export function FoodThumbnail({ src, name, className = '' }: { src?: string; name: string; className?: string }) {
  return <img className={`rb-food-thumbnail ${className}`} src={src || '/placeholder-food.svg'} alt={name} loading="lazy"
    onError={(event) => {
      const image = event.currentTarget;
      if (image.getAttribute('src') !== '/placeholder-food.svg') image.src = '/placeholder-food.svg';
    }} />;
}
