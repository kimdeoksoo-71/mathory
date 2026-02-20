import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth } from './firebase';

const storage = getStorage();

export async function uploadImage(file: File, problemId: string): Promise<string> {
  const timestamp = Date.now();
  const fileName = `${timestamp}-${file.name}`;
  const path = `problems/${problemId}/${fileName}`;
  const storageRef = ref(storage, path);

  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);
  return url;
}