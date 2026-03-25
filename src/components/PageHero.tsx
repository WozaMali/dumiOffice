import type { ReactNode } from "react";

interface PageHeroProps {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
  aside?: ReactNode;
}

const PageHero = ({ eyebrow, title, description, actions, aside }: PageHeroProps) => {
  return (
    <section className="page-stage mb-8">
      <div className="page-hero">
        <div>
          <p className="page-eyebrow">{eyebrow}</p>
          <h1 className="page-title">{title}</h1>
          <p className="page-copy">{description}</p>
          {actions ? <div className="page-actions mt-6">{actions}</div> : null}
        </div>
        {aside ? <div className="page-aside xl:max-w-sm">{aside}</div> : null}
      </div>
    </section>
  );
};

export default PageHero;
