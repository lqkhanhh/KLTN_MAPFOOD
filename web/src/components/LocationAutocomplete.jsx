import { useEffect, useRef, useState } from 'react';

const NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search';

/** Gõ tên đường/quận và chọn gợi ý để nhận cả địa chỉ lẫn tọa độ. */
export default function LocationAutocomplete({ value, placeholder, onChange, onSelect, children }) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const timer = useRef(null);

  useEffect(() => {
    const text = value?.address?.trim() || '';
    clearTimeout(timer.current);
    if (!focused || text.length < 3 || (Number.isFinite(value?.lat) && Number.isFinite(value?.lng))) {
      setSuggestions([]);
      setLoading(false);
      return undefined;
    }
    const controller = new AbortController();
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ format: 'jsonv2', limit: '5', 'accept-language': 'vi', q: text });
        const response = await fetch(`${NOMINATIM_SEARCH_URL}?${params}`, { signal: controller.signal });
        if (!response.ok) throw new Error('Nominatim unavailable');
        const rows = await response.json();
        setSuggestions(Array.isArray(rows) ? rows : []);
      } catch (error) {
        if (error.name !== 'AbortError') setSuggestions([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 450);
    return () => { clearTimeout(timer.current); controller.abort(); };
  }, [focused, value?.address, value?.lat, value?.lng]);

  function select(place) {
    onSelect({ address: place.display_name, lat: Number(place.lat), lng: Number(place.lon) });
    setSuggestions([]);
  }

  return <div className="location-autocomplete">
    <input value={value?.address || ''} placeholder={placeholder} autoComplete="off" onFocus={() => setFocused(true)} onBlur={() => window.setTimeout(() => setFocused(false), 160)} onChange={(event) => onChange({ address: event.target.value, lat: null, lng: null })} />
    {children ? <div className="location-input-actions">{children}</div> : null}
    {focused && (loading || suggestions.length > 0) ? <div className="location-suggestions" role="listbox">
      {loading ? <p>Đang tìm địa điểm…</p> : suggestions.map((place) => <button type="button" role="option" key={place.place_id} onMouseDown={(event) => event.preventDefault()} onClick={() => select(place)}><span>📍</span><strong>{place.display_name}</strong></button>)}
    </div> : null}
  </div>;
}
