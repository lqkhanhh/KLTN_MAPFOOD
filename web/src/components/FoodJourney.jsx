export function FoodJourney() {
  return <div className="food-journey" aria-hidden="true">
    <svg viewBox="0 0 400 310" focusable="false">
      <ellipse cx="205" cy="275" rx="140" ry="18" fill="#8b493b" opacity=".1" />
      <path d="M25 230C-5 90 155 285 195 90S380 90 370 220" fill="none" stroke="#bd7755" strokeWidth="2" strokeDasharray="7 9" />
      <circle cx="200" cy="155" r="121" fill="#e9b778" />
      <circle cx="200" cy="155" r="108" fill="#fffdf5" />
      <circle cx="200" cy="155" r="87" fill="#f4e9d7" stroke="#e6d8be" strokeWidth="2" />
      <path d="M125 152Q130 85 194 95Q228 130 185 193Q130 198 125 152" fill="#fffdf5" />
      <g fill="#e2cfaa"><ellipse cx="148" cy="128" rx="3" ry="1.5" /><ellipse cx="164" cy="153" rx="3" ry="1.5" /><ellipse cx="145" cy="165" rx="3" ry="1.5" /><ellipse cx="184" cy="117" rx="3" ry="1.5" /></g>
      <path d="M194 166Q168 127 205 111Q251 98 271 150Q262 186 221 194Z" fill="#aa4c2d" />
      <path d="m204 125 39 40m-47-22 29 33m-8-53 36 33" stroke="#673421" strokeWidth="5" strokeLinecap="round" />
      <g fill="#68916a" stroke="#d4e5b7" strokeWidth="5"><circle cx="231" cy="216" r="18" /><circle cx="262" cy="199" r="18" /><circle cx="278" cy="176" r="18" /></g>
      <path d="M137 203Q143 181 172 192Q193 206 172 225Q147 236 137 203" fill="#fff" /><circle cx="163" cy="209" r="12" fill="#efb43f" />
      <path d="M100 55q-10-17 6-29m13 26q-10-17 6-29" fill="none" stroke="#a06e48" strokeWidth="3" strokeLinecap="round" className="food-steam" />
      <g transform="translate(316 44)"><path d="M0 0a22 22 0 1 1 44 0c0 18-22 36-22 36S0 18 0 0" fill="#9b432b" /><circle cx="22" cy="0" r="7" fill="#ffedcf" /></g>
    </svg>
    <span className="journey-note journey-note-top">Một điểm dừng ngon</span>
    <span className="journey-note journey-note-bottom">Chọn món · Ghé lấy · Đi tiếp</span>
  </div>;
}
