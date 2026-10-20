import { ImageResponse } from 'next/og'

/* L'icône de l'onglet du CRM (V3.29) : le « E » d'Emilio, blanc sur le bleu
   de l'agence. L'image est écrite ici, en clair, plutôt que lue sur le
   disque : ce fichier est rendu au moment de la construction, sans adresse
   de site pour aller la chercher. Les originaux sont dans public/logos/. */

export const size = { width: 64, height: 64 }
export const contentType = 'image/png'

const E = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAADxUlEQVR42u2bS28SURTHzwy0JPS96MbSCoWWh0k7QNcu1YXRmNZaE5fGxK9gNEY/i5/DRasLZoYBhoe2IBBb05omTWlSwgABF5UKzJkZqkMHmXt2PZc7nfu7/3PuObeFAg1bYdaa8B+bGOcptXFqWBfeKwjaDItXWxM17AvXUgMNJjfabLvfvVbabIvvhmD6EKDMuPuaxyABQAAQAAQAAUAAEACmMOvfTrTb7fBp+yNYLBbZ2PrjLcjlvqHzHj64D+/fvUXHnr94CRzHo2Mb64/gzetXMn82m4ONzafXr4ByuQzpTAYdC/j9ivNCoZDiWJBhFMf8Ph/qZxWAXUsI8HwUf1m/V3FOOBxUhhNcVQYQwKFGWNY4ACwXvdJuzc7OwrzDodyhrawATctfyWq1wpLHLfM3Gg3gecE4ALFYHOr1uszv9S6jC1kLh1SfNzZmh+XlJZnf43HD6OiozJ/JfIHz83PjAFQqFUilM2iCXFiYv5L81fKAUk6JsJzxx6BS1sbCIBwKaT4vFEQABBQS4CAD6H7p6elpcLmc2gpAEiEGs1qtQiyeMB5APCFCrVbTfOlwOAgU1Xk1/31/HxqNhixRzs3duPzZYrHAEpIXRDEJkiQZD0CSJEgmUzK/z+fVlP/Ozmf4ururmgc87kWwIQkwwvKgh+lSCnNIPTAxMQEOx1wbgCBaRwhCHAkDRvP8ZzlusAG0h8H4+LjseGs2mxAVBIgKgmoixE6AcrkMqVR6cACICRGkahWpCH2XO9pdF+xlc1AqnaEKcLmcMDU1+RuAPAEKCvWHYQCkahWSYhJRgFdV/gAAp6enkC8UOsYoigKGWQWaptHCSI/jT/d2GAuDlgKwAqi9j0DzAMOA270INputLwWQ/gCQemBmZgaczpuyOG7F/x8AApoIMfmXSmewt5c1/j5AlgeSKZAkSbZjW082wWq1ovHfsqgQkz3vVsAP+XweVU537TAQCqjVapBIiOgFiFYbfXT0Ew4PDzt8IyMjcO/uHd3b375eiWF5wG6393SPgOUBbC6rUwHUFwC93M50x/+fMNDu64+Pj6FQLA4ugFQqDZVKRfUz3fGvpoB+777uAOr1umaHpnSNVigW4eTkRENh3GADUGuPtQBc3DCpw4sMugIuAESvHP+95IGDgx+yk0IPI/8gASY38qexfv+C7WeT/zT/9oczogACgADon5FjkIQAAUAAEAAEAAFgYgBa36sbZhPjPEUU0CJhxt3vyAFmgkC+N9jeDGHOYW2QMJXTvX5wGBevqIBhUoPWZv4CtJqJbY1WgbkAAAAASUVORK5CYII='

export default function Icon() {
  return new ImageResponse(
    (
      <div style={{ width: 64, height: 64, display: 'flex' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={E} width={64} height={64} alt="" />
      </div>
    ),
    { ...size }
  )
}
