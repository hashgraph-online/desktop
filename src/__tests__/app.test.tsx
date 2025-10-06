import { render, screen } from '@testing-library/react';
import App from '../renderer/App';

describe('App', () => {
  it('renders placeholder copy', () => {
    render(<App />);
    expect(screen.getByText('Hashgraph Online Desktop')).toBeInTheDocument();
  });
});
