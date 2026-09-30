import { useState } from 'react';
import { apiFetch, ApiError } from '../api';

function validate({ quantity }) {
  const errors = {};
  const quantityNum = Number(quantity);
  if (quantity === '' || !Number.isInteger(quantityNum) || quantityNum <= 0) {
    errors.quantity = 'Quantity must be a positive whole number';
  }
  return errors;
}

export default function RecordMovementForm({ productId, onRecorded }) {
  const [type, setType] = useState('in');
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();

    const errors = validate({ quantity });
    setFieldErrors(errors);
    setFormError(null);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      await apiFetch(`/products/${productId}/movements`, {
        method: 'POST',
        body: JSON.stringify({
          type,
          quantity: Number(quantity),
          note: note.trim() === '' ? undefined : note.trim(),
        }),
      });
      setQuantity('');
      setNote('');
      // Wait for the refetch too, not just the write, so the button stays
      // in its "in progress" state until the displayed stock/history have
      // actually caught up (the two are separate requests).
      await onRecorded();
    } catch (err) {
      if (err instanceof ApiError && err.field) {
        setFieldErrors({ [err.field]: err.message });
      } else if (err instanceof ApiError) {
        setFormError(err.message);
      } else {
        setFormError('Something went wrong. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="movement-form" onSubmit={handleSubmit} noValidate>
      <h2>Record movement</h2>

      <div className="movement-form-row">
        <label>
          Type
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="in">In</option>
            <option value="out">Out</option>
          </select>
        </label>

        <label>
          Quantity
          <input
            type="number"
            min="1"
            step="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
          {fieldErrors.quantity && <span className="field-error">{fieldErrors.quantity}</span>}
        </label>

        <label className="movement-form-note">
          Note (optional)
          <input type="text" value={note} onChange={(e) => setNote(e.target.value)} />
        </label>

        <button type="submit" disabled={submitting}>
          {submitting ? 'Recording…' : 'Record movement'}
        </button>
      </div>

      {formError && <p className="form-error">{formError}</p>}
    </form>
  );
}
