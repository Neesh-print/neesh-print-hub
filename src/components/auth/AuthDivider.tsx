export interface AuthDividerProps {
  text?: string;
}

export const AuthDivider = ({ text = 'or' }: AuthDividerProps) => {
  return (
    <div className="flex items-center gap-4 my-6">
      <div className="flex-1 border-t border-dashed border-border" />
      <span className="text-caption text-text-secondary">{text}</span>
      <div className="flex-1 border-t border-dashed border-border" />
    </div>
  );
};
