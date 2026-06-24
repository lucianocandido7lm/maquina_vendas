import React from 'react';
import './Card.css';

const Card = ({ children, title, subtitle, className = '', ghostBorder = false, ...props }) => {
  return (
    <div className={`sovereign-card ${ghostBorder ? 'ghost-border' : ''} ${className}`} {...props}>
      {(title || subtitle) && (
        <div className="card-header">
          {title && <h3 className="headline-sm card-title">{title}</h3>}
          {subtitle && <p className="body-sm text-variant">{subtitle}</p>}
        </div>
      )}
      <div className="card-body">
        {children}
      </div>
    </div>
  );
};

export default Card;
