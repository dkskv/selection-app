import { Spin } from 'antd';

type LoaderRowProps = {
  loading: boolean;
};

export function LoaderRow({ loading }: LoaderRowProps) {
  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {loading && <Spin size="small" />}
    </div>
  );
}
