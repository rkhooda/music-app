import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { jsonFileStorage } from '../lib/storage';
import { MusicTrack } from '../types/music';

export interface Playlist {
  id: string;
  title: string;
  tracks: MusicTrack[];
  coverUri?: string;
  createdAt: number;
}

interface PlaylistState {
  playlists: Playlist[];
  createPlaylist: (title?: string) => string;
  renamePlaylist: (playlistId: string, title: string) => void;
  addTrackToPlaylist: (playlistId: string, track: MusicTrack) => void;
  removeTrackFromPlaylist: (playlistId: string, trackId: string) => void;
  setPlaylistCover: (playlistId: string, coverUri: string) => void;
  deletePlaylist: (playlistId: string) => void;
}

const update = (playlists: Playlist[], playlistId: string, change: (playlist: Playlist) => Playlist) =>
  playlists.map((playlist) => (playlist.id === playlistId ? change(playlist) : playlist));

export const usePlaylistStore = create<PlaylistState>()(
  persist(
    (set) => ({
      playlists: [],
      createPlaylist: (title = 'New playlist') => {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        set((state) => ({ playlists: [...state.playlists, { id, title, tracks: [], createdAt: Date.now() }] }));
        return id;
      },
      renamePlaylist: (playlistId, title) => {
        const trimmed = title.trim();
        if (!trimmed) return;
        set((state) => ({ playlists: update(state.playlists, playlistId, (playlist) => ({ ...playlist, title: trimmed })) }));
      },
      addTrackToPlaylist: (playlistId, track) => {
        set((state) => ({
          playlists: update(state.playlists, playlistId, (playlist) =>
            playlist.tracks.some((item) => item.id === track.id) ? playlist : { ...playlist, tracks: [...playlist.tracks, track] },
          ),
        }));
      },
      removeTrackFromPlaylist: (playlistId, trackId) => {
        set((state) => ({
          playlists: update(state.playlists, playlistId, (playlist) => ({
            ...playlist,
            tracks: playlist.tracks.filter((item) => item.id !== trackId),
          })),
        }));
      },
      setPlaylistCover: (playlistId, coverUri) => {
        set((state) => ({ playlists: update(state.playlists, playlistId, (playlist) => ({ ...playlist, coverUri })) }));
      },
      deletePlaylist: (playlistId) => {
        set((state) => ({ playlists: state.playlists.filter((playlist) => playlist.id !== playlistId) }));
      },
    }),
    { name: 'playlists', storage: jsonFileStorage() },
  ),
);

export const selectPlaylist = (playlistId: string) => (state: PlaylistState) =>
  state.playlists.find((playlist) => playlist.id === playlistId);
