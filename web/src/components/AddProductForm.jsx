import { useState } from 'react';
import { apiFetch, ApiError } from '../api';

function validate({ name, sku, reorderThreshold }) {
  const errors = {};
  if (!name.trim()) errors.name = 'Name is required';
  if (!sku.trim()) errors.sku = 'SKU is required';

  const thresholdNum = Number(reorderThreshold);
  if (reorderThreshold === '' || !Number.isInteger(thresholdNum) || thresholdNum < 0) {
    errors.reorderThreshold = 'Reorder threshold must be a non-negative whole number';
  }

  return errors;
}

export default function AddProductForm({ onClose, onCreated }) {
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [reorderThreshold, setReorderThreshold] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();

    const errors = validate({ name, sku, reorderThreshold });
    setFieldErrors(errors);
    setFormError(null);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      await apiFetch('/products', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          sku: sku.trim(),
          reorderThreshold: Number(reorderThreshold),
        }),
      });
      onCreated();
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
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Add product</h2>
        <form onSubmit={handleSubmit} noValidate>
          <label>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} />
            {fieldErrors.name && <span className="field-error">{fieldErrors.name}</span>}
          </label>

          <label>
            SKU
            <input value={sku} onChange={(e) => setSku(e.target.value)} />
            {fieldErrors.sku && <span className="field-error">{fieldErrors.sku}</span>}
          </label>

          <label>
            Reorder threshold
            <input
              type="number"
              min="0"
              step="1"
              value={reorderThreshold}
              onChange={(e) => setReorderThreshold(e.target.value)}
            />
            {fieldErrors.reorderThreshold && (
              <span className="field-error">{fieldErrors.reorderThreshold}</span>
            )}
          </label>

          {formError && <p className="form-error">{formError}</p>}

          <div className="modal-actions">
            <button type="button" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" disabled={submitting}>
              {submitting ? 'Adding…' : 'Add product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
