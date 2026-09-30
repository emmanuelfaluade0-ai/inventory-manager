import { Link, useParams } from 'react-router-dom';

export default function ProductDetailPage() {
  const { id } = useParams();

  return (
    <div className="page">
      <Link to="/">&larr; Back to products</Link>
      <p className="status">Product detail page coming soon ({id}).</p>
    </div>
  );
}
