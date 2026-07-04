import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Progress } from './ui/progress';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { useAuth } from '../contexts/AuthContext';
import { useSessions, useNotifications, usePatients, usePractitionerFeedback, useTasks } from '../hooks/useDatabase';
import {
  Calendar,
  Clock,
  Users,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Video,
  RotateCcw,
  Eye,
  Bell,
  Activity,
  MessageSquare,
  CheckSquare,
  FileText,
  Timer,
  ChevronRight,
  StarIcon,
  AlertCircle,
  Info,
  CheckCircle2,
  ExternalLink,
  Stethoscope,
  Calendar as CalendarIcon,
  BrainCircuit,
  HeartHandshake,
  Sparkles,
  Target,
  UserCheck,
  BookOpen
} from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// Weekly data is computed dynamically inside the component from live Firestore sessions.

export function PractitionerDashboard({ onPageChange }) {
  const [selectedFilter, setSelectedFilter] = React.useState('today');
  const { userProfile, currentUser, loading } = useAuth();
  const [notificationFilter, setNotificationFilter] = React.useState('all');
  const [showAllNotifications, setShowAllNotifications] = React.useState(false);

  // Fetch real data from Firestore
  const { sessions: allSessions = [], upcomingSessions: upcomingSessionsData = [], loading: sessionsLoading } = useSessions(currentUser?.uid, 'practitioner');
  const { notifications: liveNotifications = [], markAsRead, loading: notificationsLoading } = useNotifications(currentUser?.uid);
  const { patients: livePatients = [], loading: patientsLoading } = usePatients(currentUser?.uid);
  const { feedback: liveFeedback = [] } = usePractitionerFeedback(currentUser?.uid);
  const { tasks: liveTasks = [], toggleTask: toggleTaskComplete, loading: tasksLoading } = useTasks(currentUser?.uid);

  // Compute today's sessions from live data
  const todaysSessions = React.useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return (allSessions || []).filter(s => {
      const sDate = s.date?.seconds ? new Date(s.date.seconds * 1000) : new Date(s.date);
      return sDate >= today && sDate < tomorrow;
    }).map(s => ({
      id: s.id,
      time: s.time || 'TBD',
      patient: s.patientName || 'Patient',
      therapy: s.therapy || 'Therapy',
      status: s.status || 'confirmed',
      duration: s.duration || '60 min',
      room: s.location || 'Room A',
      avatar: '/placeholder-avatar.jpg',
      patientId: s.patientId
    }));
  }, [allSessions]);

  // Use live notifications, map to expected shape
  const notifications = React.useMemo(() => {
    return (liveNotifications || []).map(n => ({
      id: n.id,
      type: n.type || 'system',
      category: n.category || 'general',
      title: n.title || 'Notification',
      message: n.message || '',
      time: n.time || (n.createdAt?.seconds ? new Date(n.createdAt.seconds * 1000).toLocaleString() : 'Recently'),
      priority: n.priority || 'medium',
      actionRequired: n.actionRequired || false,
      patient: n.patientName || null,
      icon: Bell
    }));
  }, [liveNotifications]);

  // Map patients from live data
  const patients = React.useMemo(() => {
    return (livePatients || []).map(p => ({
      id: p.id,
      name: p.name || 'Patient',
      avatar: '/placeholder-avatar.jpg',
      status: 'active',
      progress: 50,
      lastSession: 'N/A',
      nextSession: 'N/A',
      therapy: p.assignedTherapy || 'Pending',
      notes: p.notes || '',
      totalSessions: 0,
      completedSessions: 0
    }));
  }, [livePatients]);

  // Use live tasks or empty
  const taskReminders = React.useMemo(() => {
    return (liveTasks || []).map(t => ({
      id: t.id,
      task: t.title || t.task || 'Task',
      completed: t.completed || false,
      priority: t.priority || 'medium',
      dueDate: t.dueDate || 'Today',
      category: t.category || 'general'
    }));
  }, [liveTasks]);

  const weeklyData = React.useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const data = [
      { name: 'Mon', sessions: 0, satisfaction: 0, efficiency: 0 },
      { name: 'Tue', sessions: 0, satisfaction: 0, efficiency: 0 },
      { name: 'Wed', sessions: 0, satisfaction: 0, efficiency: 0 },
      { name: 'Thu', sessions: 0, satisfaction: 0, efficiency: 0 },
      { name: 'Fri', sessions: 0, satisfaction: 0, efficiency: 0 },
      { name: 'Sat', sessions: 0, satisfaction: 0, efficiency: 0 },
      { name: 'Sun', sessions: 0, satisfaction: 0, efficiency: 0 }
    ];

    const today = new Date();
    const currentDay = today.getDay(); 
    const mondayDiff = currentDay === 0 ? -6 : 1 - currentDay;
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() + mondayDiff);
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);

    const weeklySessions = (allSessions || []).filter(s => {
      const sDate = s.date?.seconds ? new Date(s.date.seconds * 1000) : new Date(s.date);
      return sDate >= startOfWeek && sDate < endOfWeek;
    });

    weeklySessions.forEach(s => {
      const sDate = s.date?.seconds ? new Date(s.date.seconds * 1000) : new Date(s.date);
      const dayName = days[sDate.getDay()];
      const dayObj = data.find(d => d.name === dayName);
      if (dayObj) {
        dayObj.sessions += 1;
        dayObj.satisfaction = dayObj.sessions > 0 ? 4.5 : 0;
        dayObj.efficiency = dayObj.sessions > 0 ? 85 : 0;
      }
    });

    return data;
  }, [allSessions]);

  const displayName =
    userProfile?.name ||
    currentUser?.displayName ||
    (currentUser?.email ? currentUser.email.split('@')[0] : '');

    const specName =
    userProfile?.specialization ||
    currentUser?.specialization

  const getStatusColor = (status) => {
    switch (status) {
      case 'confirmed': return 'bg-green-100 text-green-800 border-green-200';
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'rescheduled': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getPatientStatusColor = (status) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 border-green-200';
      case 'needs-attention': return 'bg-red-100 text-red-800 border-red-200';
      case 'on-treatment': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'urgent': return AlertTriangle;
      case 'appointment': return Calendar;
      case 'completion': return CheckCircle2;
      case 'feedback': return StarIcon;
      case 'system': return Info;
      case 'wellness': return BrainCircuit;
      case 'missed': return XCircle;
      case 'success': return CheckCircle;
      default: return Bell;
    }
  };

  const handleSessionAction = (sessionId, action) => {
    console.log(`${action} session ${sessionId}`);
  };

  const handleNotificationAction = (notificationId, action) => {
    if (action === 'dismiss') {
      markAsRead(notificationId);
    }
    console.log(`${action} notification ${notificationId}`);
  };

  const toggleTask = (taskId) => {
    const task = taskReminders.find(t => t.id === taskId);
    if (task) toggleTaskComplete(taskId, !task.completed);
  };

  const filteredNotifications = notifications.filter(notification => {
    if (notificationFilter === 'all') return true;
    if (notificationFilter === 'urgent') return notification.priority === 'urgent';
    if (notificationFilter === 'high') return notification.priority === 'high';
    if (notificationFilter === 'action-required') return notification.actionRequired;
    return notification.category === notificationFilter;
  });

  const displayedNotifications = showAllNotifications 
    ? filteredNotifications 
    : filteredNotifications.slice(0, 6);

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50">
      <div className="p-6 max-w-7xl mx-auto">
        {/* Enhanced Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-emerald-900 mb-2">Practitioner Dashboard</h1>
              <div className="flex items-center space-x-4">
                <p className="text-emerald-600 text-lg">Welcome back, {loading ? '…' : displayName}</p>
                <Badge className="bg-emerald-100 text-emerald-800 px-3 py-1">
                  <Stethoscope className="w-4 h-4 mr-1" />
                 <p>{specName ? specName : "Doctor"}</p>
                </Badge>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl px-6 py-3 border border-emerald-200 shadow-lg">
                <div className="flex items-center space-x-3">
                  <CalendarIcon className="w-5 h-5 text-emerald-600" />
                  <div>
                    <p className="text-xs text-emerald-600">Today</p>
                    <p className="font-medium text-emerald-900">
                      {new Date().toLocaleDateString('en-US', { 
                        weekday: 'long', 
                        month: 'short', 
                        day: 'numeric' 
                      })}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Enhanced Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="bg-white/90 backdrop-blur-sm border-emerald-200 shadow-xl hover:shadow-2xl transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-emerald-600 text-sm font-medium">Today's Sessions</p>
                  <p className="text-3xl font-bold text-emerald-900">{todaysSessions.length}</p>
                  <p className="text-xs text-emerald-500 mt-1">
                    {todaysSessions.filter(s => s.status === 'confirmed').length} confirmed
                  </p>
                </div>
                <div className="bg-gradient-to-br from-emerald-100 to-emerald-200 p-4 rounded-2xl">
                  <Calendar className="w-8 h-8 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/90 backdrop-blur-sm border-teal-200 shadow-xl hover:shadow-2xl transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-teal-600 text-sm font-medium">Active Patients</p>
                  <p className="text-3xl font-bold text-teal-900">{patients.length}</p>
                  <p className="text-xs text-teal-500 mt-1">
                    {patients.filter(p => p.status === 'needs-attention').length} need attention
                  </p>
                </div>
                <div className="bg-gradient-to-br from-teal-100 to-teal-200 p-4 rounded-2xl">
                  <Users className="w-8 h-8 text-teal-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/90 backdrop-blur-sm border-cyan-200 shadow-xl hover:shadow-2xl transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-cyan-600 text-sm font-medium">Pending Actions</p>
                  <p className="text-3xl font-bold text-cyan-900">
                    {taskReminders.filter(t => !t.completed && (t.priority === 'urgent' || t.priority === 'high')).length}
                  </p>
                  <p className="text-xs text-cyan-500 mt-1">Urgent tasks due</p>
                </div>
                <div className="bg-gradient-to-br from-cyan-100 to-cyan-200 p-4 rounded-2xl">
                  <CheckSquare className="w-8 h-8 text-cyan-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/90 backdrop-blur-sm border-orange-200 shadow-xl hover:shadow-2xl transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-orange-600 text-sm font-medium">Notifications</p>
                  <p className="text-3xl font-bold text-orange-900">
                    {notifications.filter(n => n.actionRequired).length}
                  </p>
                  <p className="text-xs text-orange-500 mt-1">Require action</p>
                </div>
                <div className="bg-gradient-to-br from-orange-100 to-orange-200 p-4 rounded-2xl">
                  <Bell className="w-8 h-8 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 mb-8">
          {/* Enhanced Schedule */}
          <Card className="xl:col-span-2 bg-white/95 backdrop-blur-sm border-emerald-200 shadow-xl">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-emerald-900 text-xl">Today's Schedule</CardTitle>
                  <CardDescription className="text-emerald-600">
                    Manage your appointments and sessions
                  </CardDescription>
                </div>
                <div className="flex items-center space-x-2">
                  <Select value={selectedFilter} onValueChange={setSelectedFilter}>
                    <SelectTrigger className="w-32 border-emerald-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="today">Today</SelectItem>
                      <SelectItem value="week">This Week</SelectItem>
                      <SelectItem value="month">This Month</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button 
                    onClick={() => onPageChange('schedule')}
                    variant="outline"
                    size="sm"
                    className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    View All
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {todaysSessions.map((session) => (
                  <div key={session.id} className="bg-gradient-to-r from-gray-50 to-emerald-50 border border-emerald-100 rounded-2xl p-6 hover:shadow-lg transition-all duration-300">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="bg-emerald-100 p-3 rounded-xl">
                          <Clock className="w-5 h-5 text-emerald-600" />
                        </div>
                        <Avatar className="w-12 h-12 border-2 border-emerald-200">
                          <AvatarImage src={session.avatar} />
                          <AvatarFallback className="bg-emerald-100 text-emerald-700">
                            {session.patient.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="flex items-center space-x-3 mb-1">
                            <p className="font-bold text-gray-900">{session.time}</p>
                            <Badge className={getStatusColor(session.status)}>
                              {session.status}
                            </Badge>
                          </div>
                          <p className="font-medium text-gray-900">{session.patient}</p>
                          <div className="flex items-center space-x-4 text-sm text-gray-600 mt-1">
                            <span>{session.therapy}</span>
                            <span>•</span>
                            <span>{session.duration}</span>
                            <span>•</span>
                            <span>{session.room}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          size="sm"
                          onClick={() => {
                            localStorage.setItem('auto_start_call', 'true');
                            localStorage.setItem('active_call_partner_id', session.patientId || 'patient_001');
                            localStorage.setItem('active_call_partner_name', session.patient || 'Priya Sharma');
                            onPageChange('communication');
                          }}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium flex items-center space-x-1 shadow-sm hover:shadow-md transition-all"
                        >
                          <Video className="w-3.5 h-3.5" />
                          <span>Join Call</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSessionAction(session.id, 'approve')}
                          className="text-green-600 border-green-300 hover:bg-green-50"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSessionAction(session.id, 'reschedule')}
                          className="text-blue-600 border-blue-300 hover:bg-blue-50"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSessionAction(session.id, 'cancel')}
                          className="text-red-600 border-red-300 hover:bg-red-50"
                        >
                          <XCircle className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Enhanced Notifications Center */}
          <Card className="bg-white/95 backdrop-blur-sm border-blue-200 shadow-xl">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-blue-900 flex items-center">
                  <Bell className="w-6 h-6 mr-2" />
                  Notifications Center
                </CardTitle>
                <Badge className="bg-blue-100 text-blue-700">
                  {notifications.filter(n => n.actionRequired).length} Action Required
                </Badge>
              </div>
              <CardDescription className="text-blue-600">
                Stay updated with patient care and system alerts
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Select value={notificationFilter} onValueChange={setNotificationFilter}>
                  <SelectTrigger className="border-blue-200">
                    <SelectValue placeholder="Filter notifications" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Notifications</SelectItem>
                    <SelectItem value="urgent">Urgent Only</SelectItem>
                    <SelectItem value="high">High Priority</SelectItem>
                    <SelectItem value="action-required">Action Required</SelectItem>
                    <SelectItem value="patient-alert">Patient Alerts</SelectItem>
                    <SelectItem value="schedule">Schedule Changes</SelectItem>
                    <SelectItem value="patient-feedback">Patient Feedback</SelectItem>
                  </SelectContent>
                </Select>

                <ScrollArea className="h-96">
                  <div className="space-y-3">
                    {displayedNotifications.map((notification) => {
                      const IconComponent = notification.icon;
                      return (
                        <div key={notification.id} className={`p-4 rounded-xl border-l-4 hover:shadow-md transition-all duration-200 ${
                          notification.priority === 'urgent' ? 'bg-red-50 border-l-red-500 border border-red-200' :
                          notification.priority === 'high' ? 'bg-orange-50 border-l-orange-500 border border-orange-200' :
                          notification.priority === 'medium' ? 'bg-yellow-50 border-l-yellow-500 border border-yellow-200' :
                          'bg-green-50 border-l-green-500 border border-green-200'
                        }`}>
                          <div className="flex items-start space-x-3">
                            <div className={`p-2 rounded-lg ${
                              notification.priority === 'urgent' ? 'bg-red-100' :
                              notification.priority === 'high' ? 'bg-orange-100' :
                              notification.priority === 'medium' ? 'bg-yellow-100' :
                              'bg-green-100'
                            }`}>
                              <IconComponent className={`w-4 h-4 ${
                                notification.priority === 'urgent' ? 'text-red-600' :
                                notification.priority === 'high' ? 'text-orange-600' :
                                notification.priority === 'medium' ? 'text-yellow-600' :
                                'text-green-600'
                              }`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1">
                                <p className="font-medium text-gray-900 text-sm">{notification.title}</p>
                                <Badge className={getPriorityColor(notification.priority)} variant="outline">
                                  {notification.priority}
                                </Badge>
                              </div>
                              <p className="text-sm text-gray-600 mb-2">{notification.message}</p>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2 text-xs text-gray-500">
                                  <Timer className="w-3 h-3" />
                                  <span>{notification.time}</span>
                                  {notification.patient && (
                                    <>
                                      <span>•</span>
                                      <UserCheck className="w-3 h-3" />
                                      <span>{notification.patient}</span>
                                    </>
                                  )}
                                </div>
                                {notification.actionRequired && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleNotificationAction(notification.id, 'view')}
                                    className="text-xs px-2 py-1 h-6"
                                  >
                                    <ExternalLink className="w-3 h-3 mr-1" />
                                    Action
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>

                {filteredNotifications.length > 6 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAllNotifications(!showAllNotifications)}
                    className="w-full border-blue-200 text-blue-600 hover:bg-blue-50"
                  >
                    {showAllNotifications ? 'Show Less' : `View All ${filteredNotifications.length} Notifications`}
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Enhanced Patient Overview & Analytics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Enhanced Patient Management */}
          <Card className="bg-white/95 backdrop-blur-sm border-emerald-200 shadow-xl">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-emerald-900 text-xl">Patient Overview</CardTitle>
                  <CardDescription className="text-emerald-600">
                    Monitor patient progress and status
                  </CardDescription>
                </div>
                <Button 
                  onClick={() => onPageChange('patients')}
                  variant="outline"
                  size="sm"
                  className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                >
                  <Eye className="w-4 h-4 mr-1" />
                  View All
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {patients.map((patient) => (
                  <div key={patient.id} className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-100 rounded-2xl p-6 hover:shadow-lg transition-all duration-300">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-4">
                        <Avatar className="w-12 h-12 border-2 border-emerald-200">
                          <AvatarImage src={patient.avatar} />
                          <AvatarFallback className="bg-emerald-100 text-emerald-700">
                            {patient.name.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="flex items-center space-x-3 mb-1">
                            <p className="font-bold text-gray-900">{patient.name}</p>
                            <Badge className={getPatientStatusColor(patient.status)}>
                              {patient.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-emerald-700">{patient.therapy}</p>
                          <p className="text-xs text-gray-600 mt-1">{patient.notes}</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-medium text-gray-700">Treatment Progress</span>
                          <span className="text-sm text-emerald-600">{patient.progress}%</span>
                        </div>
                        <Progress value={patient.progress} className="h-2" />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Last Session:</span>
                          <p className="font-medium">{patient.lastSession}</p>
                        </div>
                        <div>
                          <span className="text-gray-600">Next Session:</span>
                          <p className="font-medium">{patient.nextSession}</p>
                        </div>
                        <div>
                          <span className="text-gray-600">Completed:</span>
                          <p className="font-medium">{patient.completedSessions}/{patient.totalSessions} sessions</p>
                        </div>
                        <div className="flex justify-end">
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            Details
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Enhanced Analytics */}
          <Card className="bg-white/95 backdrop-blur-sm border-purple-200 shadow-xl">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-purple-900 text-xl">Weekly Analytics</CardTitle>
                  <CardDescription className="text-purple-600">
                    Performance metrics and insights
                  </CardDescription>
                </div>
                <Button 
                  onClick={() => onPageChange('analytics')}
                  variant="outline"
                  size="sm"
                  className="border-purple-300 text-purple-700 hover:bg-purple-50"
                >
                  <TrendingUp className="w-4 h-4 mr-1" />
                  View Detailed
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={weeklyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e0e7ff" />
                      <XAxis dataKey="name" stroke="#7c3aed" />
                      <YAxis stroke="#7c3aed" />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#f8fafc', 
                          border: '1px solid #e0e7ff',
                          borderRadius: '0.5rem'
                        }} 
                      />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="sessions" 
                        stroke="#10b981" 
                        strokeWidth={3}
                        name="Sessions"
                      />
                      <Line 
                        type="monotone" 
                        dataKey="satisfaction" 
                        stroke="#3b82f6" 
                        strokeWidth={3}
                        name="Satisfaction"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl">
                    <Activity className="w-8 h-8 text-green-600 mx-auto mb-2" />
                    <p className="text-sm text-green-800">Avg Sessions</p>
                    <p className="font-bold text-green-900">9.1/day</p>
                  </div>
                  <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl">
                    <StarIcon className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                    <p className="text-sm text-blue-800">Satisfaction</p>
                    <p className="font-bold text-blue-900">4.6/5.0</p>
                  </div>
                  <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl">
                    <Target className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                    <p className="text-sm text-purple-800">Efficiency</p>
                    <p className="font-bold text-purple-900">89%</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Enhanced Task Management */}
        <Card className="bg-white/95 backdrop-blur-sm border-orange-200 shadow-xl">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-orange-900 text-xl">Task & Reminders</CardTitle>
                <CardDescription className="text-orange-600">
                  Stay on top of your important tasks and deadlines
                </CardDescription>
              </div>
              <Button 
                onClick={() => onPageChange('tasks')}
                variant="outline"
                size="sm"
                className="border-orange-300 text-orange-700 hover:bg-orange-50"
              >
                <CheckSquare className="w-4 h-4 mr-1" />
                View All Tasks
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {taskReminders.slice(0, 5).map((task) => (
                <div key={task.id} className={`p-4 rounded-xl border-l-4 hover:shadow-md transition-all duration-200 ${
                  task.priority === 'urgent' ? 'bg-red-50 border-l-red-500 border border-red-200' :
                  task.priority === 'high' ? 'bg-orange-50 border-l-orange-500 border border-orange-200' :
                  task.priority === 'medium' ? 'bg-yellow-50 border-l-yellow-500 border border-yellow-200' :
                  'bg-green-50 border-l-green-500 border border-green-200'
                } ${task.completed ? 'opacity-60' : ''}`}>
                  <div className="flex items-start space-x-3">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toggleTask(task.id)}
                      className={`mt-1 w-6 h-6 p-0 ${task.completed ? 'bg-green-100 border-green-300' : 'border-gray-300'}`}
                    >
                      {task.completed && <CheckCircle className="w-4 h-4 text-green-600" />}
                    </Button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className={`font-medium text-gray-900 text-sm ${task.completed ? 'line-through' : ''}`}>
                          {task.task}
                        </p>
                        <Badge className={getPriorityColor(task.priority)} variant="outline">
                          {task.priority}
                        </Badge>
                      </div>
                      <div className="flex items-center space-x-4 text-xs text-gray-500">
                        <div className="flex items-center space-x-1">
                          <Timer className="w-3 h-3" />
                          <span>Due: {task.dueDate}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <FileText className="w-3 h-3" />
                          <span>{task.category}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}