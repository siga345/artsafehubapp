declare module "bcryptjs" {
  export interface BcryptJs {
    hash(data: string, saltOrRounds: string | number): Promise<string>;
    compare(data: string, encrypted: string): Promise<boolean>;
  }

  const bcrypt: BcryptJs;
  export default bcrypt;
}
