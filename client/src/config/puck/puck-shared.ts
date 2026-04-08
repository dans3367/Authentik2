export type RootProps = {
  title?: string;
  subject?: string;
  backgroundColor?: string;
  bodyBackgroundColor?: string;
  footerTextColor?: string;
};

export type PuckItem = {
  type?: string;
  props: {
    id?: string;
    [key: string]: any;
  };
  [key: string]: any;
};

export type UserData = {
  content: PuckItem[];
  root?: {
    props?: RootProps & {
      [key: string]: any;
    };
    [key: string]: any;
  };
  zones?: Record<string, PuckItem[]>;
  [key: string]: any;
};

export type RootFieldErrorState = { title: boolean };
