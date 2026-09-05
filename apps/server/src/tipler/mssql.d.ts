/**
 * `mssql` isteğe bağlı bir bağımlılık: yalnızca MIKRO_ADAPTER=mssql seçilirse
 * yüklenir. @types/mssql'i zorunlu devDependency yapmamak için modülü burada
 * bildiriyoruz; MssqlAdapter kendi dar arayüzüne (MssqlModulu) cast ediyor.
 */
declare module 'mssql';
